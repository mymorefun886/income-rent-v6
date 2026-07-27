#!/usr/bin/env python3
"""
CHSC Secondary School Profile Scraper v3
Scrapes complete school profiles from CHSC website including:
- Chinese/English names
- School information (type, gender, religion, etc.)
- Facilities
- Teacher information
- Class structure
- Subjects offered
- Mission and special features
- Assessment methods
- Student support
- Life-wide learning
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


async def get_school_profile(detail_url: str) -> dict | None:
    """Get complete school profile from detail page."""
    try:
        html = await fetch_page(detail_url)
        soup = BeautifulSoup(html, "html.parser")

        profile = {
            "name_en": "",
            "name_zh": "",
            "address": "",
            "phone": "",
            "fax": "",
            "email": "",
            "website": "",
            "district": "",
            "supervisor": "",
            "principal": "",
            "school_type": "",
            "gender": "",
            "religion": "",
            "founded_year": "",
            "motto": "",
            "campus_area": "",
            "sponsoring_body": "",
            "mission": "",
            "special_features": "",
            "facilities": "",
            "teacher_info": "",
            "class_structure": "",
            "subjects_junior": "",
            "subjects_senior": "",
            "assessment": "",
            "student_support": "",
            "life_wide_learning": "",
            "language_policy": "",
            "ethos": "",
            "fees": "",
            "transport": "",
        }

        # Extract Chinese name from title
        title = soup.find("title")
        if title:
            match = re.search(r'SSP\d{4}/\d{4}\s+(.+)', title.get_text(strip=True))
            if match:
                profile["name_zh"] = match.group(1).strip()

        # Get all text content
        page_text = soup.get_text("\n", strip=True)

        # Extract key fields using regex patterns
        patterns = {
            "address": r"地址[：:]\s*(.+?)(?:\n|電話)",
            "phone": r"電話[：:]\s*(\d[\d\s\-]+)",
            "fax": r"傳真[：:]\s*(\d[\d\s\-]+)",
            "email": r"電郵[：:]\s*(\S+@\S+)",
            "website": r"網址[：:]\s*(https?://\S+)",
            "district": r"分區[：:]\s*(.+?)(?:\n)",
            "supervisor": r"校監[：:]\s*(.+?)(?:\n|校長)",
            "principal": r"校長[：:]\s*(.+?)(?:\n)",
            "school_type": r"學校類別[：:]\s*(.+?)(?:\n)",
            "gender": r"學生性別[：:]\s*(.+?)(?:\n)",
            "religion": r"宗教[：:]\s*(.+?)(?:\n)",
            "founded_year": r"創校年份[：:]\s*(\d{4})",
            "motto": r"校訓[：:]\s*(.+?)(?:\n)",
            "campus_area": r"校園面積[：:]\s*(.+?)(?:\n)",
            "sponsoring_body": r"辦學團體[：:]\s*(.+?)(?:\n)",
        }

        for key, pattern in patterns.items():
            match = re.search(pattern, page_text, re.MULTILINE)
            if match:
                profile[key] = match.group(1).strip()

        # Extract longer text sections
        sections = {
            "mission": r"辦學宗旨(.+?)(?=學校特色|教師資料|$)",
            "special_features": r"學校特色(.+?)(?=學校設施|教師資料|$)",
            "facilities": r"學校設施(.+?)(?=2024/2025學年教師資料|$)",
            "teacher_info": r"2024/2025學年教師資料(.+?)(?=班級結構|$)",
            "class_structure": r"班級結構(.+?)(?=學習評估|$)",
            "assessment": r"學習評估(.+?)(?=學校生活|$)",
            "ethos": r"學校生活(.+?)(?=全方位學習|$)",
            "life_wide_learning": r"全方位學習(.+?)(?=學校管理|$)",
            "language_policy": r"教學語言組合(.+?)(?=班級結構|$)",
        }

        for key, pattern in sections.items():
            match = re.search(pattern, page_text, re.MULTILINE | re.DOTALL)
            if match:
                text = match.group(1).strip()
                # Clean up: limit length, remove excessive whitespace
                text = re.sub(r'\s+', ' ', text)[:2000]
                profile[key] = text

        return profile

    except Exception as e:
        return None


async def main():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    # Check if profile_data column exists
    col_check = await conn.fetchval("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'memory' AND table_name = 'school_entity'
        AND column_name = 'profile_data'
    """)

    if col_check == 0:
        await conn.execute("""
            ALTER TABLE memory.school_entity
            ADD COLUMN profile_data JSONB
        """)
        print("Added profile_data column to school_entity")

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

    # Step 2: Get full profiles
    print("\nStep 2: Fetching school profiles from detail pages...")
    success = 0

    for i, school in enumerate(all_schools):
        profile = await get_school_profile(school["detail_url"])
        if profile:
            school["profile"] = profile
            success += 1
            if i < 10 or i % 50 == 0:
                print(f"  [{i+1}/{len(all_schools)}] ✓ {school['name_en']}")
                print(f"      ZH: {profile.get('name_zh', 'N/A')}")
                print(f"      Type: {profile.get('school_type', 'N/A')}")
        else:
            if i < 10:
                print(f"  [{i+1}/{len(all_schools)}] ✗ {school['name_en']}")

        if (i + 1) % 100 == 0:
            print(f"  ... Progress: {i+1}/{len(all_schools)} (success={success})")

        await asyncio.sleep(0.2)

    print(f"\nProfiles fetched: {success}/{len(all_schools)}")

    # Step 3: Save to JSON
    with open("/tmp/chsc_school_profiles.json", "w", encoding="utf-8") as f:
        json.dump(all_schools, f, ensure_ascii=False, indent=2)
    print("Saved to /tmp/chsc_school_profiles.json")

    # Step 4: Update database
    print("\nStep 4: Updating database...")
    updated = 0
    for school in all_schools:
        if school.get("profile"):
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
                    SET profile_data = $1,
                        school_name_zh = COALESCE(school_name_zh, $2)
                    WHERE school_id = $3
                    AND source_name = 'chsc_secondary_csv'
                """, json.dumps(school["profile"], ensure_ascii=False),
                     school["profile"].get("name_zh", ""),
                     row["school_id"])
                updated += 1
                break

    print(f"Updated {updated} schools with profile data")

    # Verify
    count = await conn.fetchval("""
        SELECT COUNT(*) FROM memory.school_entity
        WHERE source_name = 'chsc_secondary_csv'
        AND profile_data IS NOT NULL
    """)
    print(f"Total CHSC schools with profile data: {count}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
