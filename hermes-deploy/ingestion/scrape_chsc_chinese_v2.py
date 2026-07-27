#!/usr/bin/env python3
"""
CHSC Secondary School Profile Scraper v4
Fixed Chinese name extraction with proper validation.
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
DISTRICT_IDS = list(range(1, 19))

DISTRICT_NAMES = {
    1: "中西區", 2: "九龍城區", 3: "葵青區", 4: "觀塘區",
    5: "黃大仙區", 6: "北區", 7: "西貢區", 8: "沙田區",
    9: "深水埗區", 10: "南區", 11: "大埔區", 12: "荃灣區",
    13: "屯門區", 14: "灣仔區", 15: "油尖旺區", 16: "元朗區",
    17: "東區", 18: "離島區"
}

# Address keywords to reject
ADDRESS_KEYWORDS = [
    "號", "樓", "座", "邨", "街", "路", "道", "里", "大廈", "室", "層",
    "地下", "平台", "花園", "廣場", "中心", "校園", "校舍"
]

# School name indicators
NAME_INDICATORS = [
    "中學", "小學", "學校", "書院", "學院", "大學", "幼稚園", "幼兒園",
    "學校", "校", "中學", "小學"
]


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


def is_valid_chinese_name(text: str) -> bool:
    """Validate if text is a valid Chinese school name (not an address)."""
    if not text:
        return False

    # Length check: school names are typically 4-25 characters
    if len(text) < 4 or len(text) > 25:
        return False

    # Must contain Chinese characters
    chinese_chars = re.findall(r'[一-鿿]', text)
    if len(chinese_chars) < 3:
        return False

    # Reject if contains address keywords
    for keyword in ADDRESS_KEYWORDS:
        if keyword in text:
            return False

    # Reject if contains phone number patterns
    if re.search(r'\d{4,}', text):
        return False

    # Reject if starts with "新界", "九龍", "香港" (likely address)
    if text.startswith(("新界", "九龍", "香港")):
        return False

    return True


def extract_chinese_name(soup: BeautifulSoup) -> str | None:
    """Extract Chinese school name from page with proper validation."""

    # Priority 1: Extract from page title
    # Format: "SSP2025/2026 佛教善德英文中學"
    title = soup.find("title")
    if title:
        title_text = title.get_text(strip=True)
        for prefix in ["SSP2025/2026 ", "SSP2025/2026", "PSP2025 ", "PSP2025"]:
            if prefix in title_text:
                name = title_text.replace(prefix, "").strip()
                if is_valid_chinese_name(name):
                    return name

    # Priority 2: Look for school name in header section (near logo)
    # The Chinese name is typically in an h1/h2/h3 tag near the top
    for tag in ["h1", "h2", "h3"]:
        for elem in soup.find_all(tag):
            text = elem.get_text(strip=True)
            if is_valid_chinese_name(text):
                return text

    # Priority 3: Look for the first valid Chinese text in the main content
    for elem in soup.find_all(["span", "div", "p", "td"]):
        text = elem.get_text(strip=True)
        if is_valid_chinese_name(text):
            return text

    return None


async def get_schools_for_district(district_id: int) -> list[dict]:
    """Get all schools for a district from the list page."""
    url = f"{BASE_URL}sch_list.php?li_id=2&district_id={district_id}&lang_id=2&frmMode=pagebreak"
    html = await fetch_page(url)
    soup = BeautifulSoup(html, "html.parser")

    schools = []
    for link in soup.find_all("a", href=re.compile(r"sch_detail\.php")):
        href = link.get("href", "")
        name = link.get_text(strip=True)
        match = re.search(r"sch_id=(\d+)", href)
        if not match or len(name) < 3 or not re.search(r'[a-zA-Z]', name):
            continue

        schools.append({
            "sch_id": match.group(1),
            "name_en": name,
            "detail_url": urljoin(BASE_URL, href),
            "district_id": district_id,
            "district_name": DISTRICT_NAMES.get(district_id, "")
        })

    return schools


async def main():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    all_schools = []

    # Step 1: Get all schools
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

    # Deduplicate
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
        try:
            html = await fetch_page(school["detail_url"])
            soup = BeautifulSoup(html, "html.parser")

            chinese_name = extract_chinese_name(soup)
            school["name_zh"] = chinese_name

            if chinese_name:
                success += 1
                if i < 20 or i % 50 == 0:
                    print(f"  [{i+1}/{len(all_schools)}] ✓ {school['name_en']}")
                    print(f"      ZH: {chinese_name}")
            else:
                failed += 1
                if i < 20:
                    print(f"  [{i+1}/{len(all_schools)}] ✗ {school['name_en']} → (not found)")

        except Exception as e:
            failed += 1
            if i < 20:
                print(f"  [{i+1}/{len(all_schools)}] ✗ {school['name_en']} → Error: {e}")

        if (i + 1) % 100 == 0:
            print(f"  ... Progress: {i+1}/{len(all_schools)} (success={success}, failed={failed})")

        await asyncio.sleep(0.2)

    print(f"\nChinese names found: {success}/{len(all_schools)}")

    # Step 3: Save to JSON
    with open("/tmp/chsc_schools_chinese_v2.json", "w", encoding="utf-8") as f:
        json.dump(all_schools, f, ensure_ascii=False, indent=2)
    print("Saved to /tmp/chsc_schools_chinese_v2.json")

    # Step 4: Update database
    print("\nStep 4: Updating database...")
    updated = 0
    for school in all_schools:
        if school.get("name_zh"):
            # Find matching school in database
            rows = await conn.fetch("""
                SELECT school_id
                FROM memory.school_entity
                WHERE source_name = 'chsc_secondary_csv'
                AND canonical_name ILIKE $1
            """, f"%{school['name_en'][:15]}%")

            for row in rows:
                await conn.execute("""
                    UPDATE memory.school_entity
                    SET school_name_zh = $1
                    WHERE school_id = $2
                    AND source_name = 'chsc_secondary_csv'
                """, school["name_zh"], row["school_id"])
                updated += 1
                break

    print(f"Updated {updated} schools with Chinese names")

    # Step 5: Validate - check for addresses in name field
    print("\nStep 5: Validating data quality...")
    invalid = await conn.fetch("""
        SELECT school_id, canonical_name, school_name_zh
        FROM memory.school_entity
        WHERE source_name = 'chsc_secondary_csv'
        AND school_name_zh IS NOT NULL
        AND (
            school_name_zh LIKE '%號%'
            OR school_name_zh LIKE '%樓%'
            OR school_name_zh LIKE '%街%'
            OR school_name_zh LIKE '%路%'
            OR school_name_zh LIKE '%道%'
            OR school_name_zh LIKE '%邨%'
            OR school_name_zh LIKE '%座%'
        )
    """)
    print(f"Invalid names (containing address keywords): {len(invalid)}")
    for r in invalid[:10]:
        print(f"  {r[0]}: {r[1]} → ZH: {r[2]}")

    # Verify
    count = await conn.fetchval("""
        SELECT COUNT(*) FROM memory.school_entity
        WHERE source_name = 'chsc_secondary_csv'
        AND school_name_zh IS NOT NULL
    """)
    print(f"\nTotal CHSC schools with Chinese names: {count}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
