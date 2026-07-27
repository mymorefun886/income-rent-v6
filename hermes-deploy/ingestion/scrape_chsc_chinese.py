#!/usr/bin/env python3
"""
CHSC Secondary School Scraper v2
Scrapes Chinese names from CHSC website and updates the database.
"""

import asyncio
import json
import re
import sys
from urllib.parse import urljoin

import asyncpg
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.chsc.hk/ssp2025/"
DISTRICT_IDS = list(range(1, 19))  # 18 districts

# District name mapping
DISTRICT_NAMES = {
    1: "中西區", 2: "九龍城區", 3: "葵青區", 4: "觀塘區",
    5: "黃大仙區", 6: "北區", 7: "西貢區", 8: "沙田區",
    9: "深水埗區", 10: "南區", 11: "大埔區", 12: "荃灣區",
    13: "屯門區", 14: "灣仔區", 15: "油尖旺區", 16: "元朗區",
    17: "東區", 18: "離島區"
}


async def fetch_page(url: str) -> str:
    """Fetch a page with retries."""
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        for attempt in range(3):
            try:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })
                resp.raise_for_status()
                return resp.text
            except Exception as e:
                if attempt == 2:
                    raise
                await asyncio.sleep(1)


async def get_schools_for_district(district_id: int) -> list[dict]:
    """Get all schools for a district from the list page."""
    url = f"{BASE_URL}sch_list.php?li_id=2&district_id={district_id}&lang_id=2&frmMode=pagebreak"
    html = await fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")

    schools = []

    # Find all links that go to school detail pages
    for link in soup.find_all("a", href=re.compile(r"sch_detail\.php")):
        href = link.get("href", "")
        name = link.get_text(strip=True)

        # Extract sch_id from URL
        match = re.search(r"sch_id=(\d+)", href)
        if not match:
            continue

        sch_id = match.group(1)

        # Skip if name is too short or doesn't contain letters
        if len(name) < 3 or not re.search(r'[a-zA-Z]', name):
            continue

        schools.append({
            "sch_id": sch_id,
            "name_en": name,
            "detail_url": urljoin(BASE_URL, href),
            "district_id": district_id,
            "district_name": DISTRICT_NAMES.get(district_id, "")
        })

    return schools


async def get_school_chinese_name(detail_url: str) -> str | None:
    """Get Chinese name from school detail page."""
    try:
        html = await fetch_page(detail_url)
        soup = BeautifulSoup(html, "html.parser")

        # Method 1: Extract from page title
        # Format: "SSP2025/2026 佛教善德英文中學"
        title = soup.find("title")
        if title:
            title_text = title.get_text(strip=True)
            # Remove the prefix "SSP2025/2026 "
            match = re.search(r'SSP\d{4}/\d{4}\s+(.+)', title_text)
            if match:
                chinese_name = match.group(1).strip()
                if re.search(r'[一-鿿]', chinese_name):
                    return chinese_name

        # Method 2: Look for Chinese name near the logo/heading
        # The Chinese name is typically in an h1/h2 tag near the top
        for tag in ["h1", "h2", "h3"]:
            for elem in soup.find_all(tag):
                text = elem.get_text(strip=True)
                if re.search(r'[一-鿿]', text) and 4 <= len(text) <= 25:
                    return text

        # Method 3: Look for the first significant Chinese text
        for elem in soup.find_all(["span", "div", "p", "td"]):
            text = elem.get_text(strip=True)
            if re.search(r'[一-鿿]', text) and 4 <= len(text) <= 20:
                # Exclude common non-name text
                if not any(skip in text for skip in ["中學概覽", "學校資料", "地址", "電話",
                                                      "傳真", "電郵", "網址", "校長", "校監",
                                                      "班級", "教師", "學生", "學費", "課室",
                                                      "SSP", "PSP"]):
                    return text

        return None
    except Exception as e:
        return None


async def main():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    # Check if school_name_zh column exists
    col_check = await conn.fetchval("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'memory' AND table_name = 'school_entity'
        AND column_name = 'school_name_zh'
    """)

    if col_check == 0:
        await conn.execute("""
            ALTER TABLE memory.school_entity
            ADD COLUMN school_name_zh TEXT
        """)
        print("Added school_name_zh column to school_entity")

    all_schools = []

    # Step 1: Get all schools from list pages
    print("Step 1: Scraping school lists from all 18 districts...")
    for district_id in DISTRICT_IDS:
        district_name = DISTRICT_NAMES.get(district_id, f"District {district_id}")
        print(f"  Scraping {district_name}...", end=" ")

        try:
            schools = await get_schools_for_district(district_id)
            print(f"Found {len(schools)} schools")
            all_schools.extend(schools)
            await asyncio.sleep(0.3)
        except Exception as e:
            print(f"Error: {e}")

    # Deduplicate by sch_id
    seen_ids = set()
    unique_schools = []
    for s in all_schools:
        if s["sch_id"] not in seen_ids:
            seen_ids.add(s["sch_id"])
            unique_schools.append(s)

    all_schools = unique_schools
    print(f"\nTotal unique schools: {len(all_schools)}")

    # Step 2: Get Chinese names from detail pages
    print("\nStep 2: Fetching Chinese names from detail pages...")
    success = 0
    failed = 0

    for i, school in enumerate(all_schools):
        chinese_name = await get_school_chinese_name(school["detail_url"])
        school["name_zh"] = chinese_name

        if chinese_name:
            success += 1
            if i < 20 or i % 50 == 0:
                print(f"  [{i+1}/{len(all_schools)}] ✓ {school['name_en']} → {chinese_name}")
        else:
            failed += 1
            if i < 20 or i % 50 == 0:
                print(f"  [{i+1}/{len(all_schools)}] ✗ {school['name_en']} → (not found)")

        # Progress update
        if (i + 1) % 100 == 0:
            print(f"  ... Progress: {i+1}/{len(all_schools)} (success={success}, failed={failed})")

        await asyncio.sleep(0.2)  # Be polite to the server

    print(f"\nChinese names found: {success}/{len(all_schools)}")

    # Step 3: Save to JSON
    with open("/tmp/chsc_schools_with_chinese.json", "w", encoding="utf-8") as f:
        json.dump(all_schools, f, ensure_ascii=False, indent=2)
    print("Saved to /tmp/chsc_schools_with_chinese.json")

    # Step 4: Update database
    print("\nStep 4: Updating database...")
    updated = 0
    for school in all_schools:
        if school.get("name_zh"):
            # Find matching school in database by English name
            rows = await conn.fetch("""
                SELECT school_id
                FROM memory.school_entity
                WHERE source_name = 'chsc_secondary_csv'
                AND (
                    canonical_name = $1
                    OR canonical_name ILIKE $2
                )
            """, school["name_en"], f"%{school['name_en'][:15]}%")

            for row in rows:
                await conn.execute("""
                    UPDATE memory.school_entity
                    SET school_name_zh = $1
                    WHERE school_id = $2
                    AND source_name = 'chsc_secondary_csv'
                """, school["name_zh"], row["school_id"])
                updated += 1
                break  # Only update first match

    print(f"Updated {updated} schools in database")

    # Verify
    count = await conn.fetchval("""
        SELECT COUNT(*) FROM memory.school_entity
        WHERE source_name = 'chsc_secondary_csv'
        AND school_name_zh IS NOT NULL
    """)
    print(f"Total CHSC schools with Chinese names: {count}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
