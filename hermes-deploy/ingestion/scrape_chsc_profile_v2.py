#!/usr/bin/env python3
"""
CHSC Profile Extraction Pipeline v2
Extracts comprehensive school profiles with proper section detection and evidence splitting.

Target: 441 schools, >3000 evidence chunks
Fields: identity, mission, features, assessment, activities, facilities, teacher, school life
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

# Language versions
LANGUAGES = [
    {"lang_id": 2, "language": "zh-HK"},  # Chinese (Traditional)
    {"lang_id": 1, "language": "en"},      # English
]

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
    "地下", "平台", "花園", "廣場", "中心", "校園", "校舍", "區", "新界", "九龍", "香港"
]

# Section mapping: CHSC section name -> evidence type
SECTION_MAP = {
    "辦學宗旨": "mission",
    "學校特色": "special_features",
    "學校管理": "school_management",
    "教學規劃": "teaching_planning",
    "學習評估": "assessment",
    "學校生活": "school_life",
    "全方位學習": "life_wide_learning",
    "學生支援": "student_support",
    "教師資料": "teacher_profile",
    "班級結構": "class_structure",
    "學校設施": "facilities",
    "課外活動": "activities",
    "課外活動及全方位學習": "activities",
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


def is_valid_chinese_name(text: str) -> bool:
    """Validate if text is a valid Chinese school name (not an address)."""
    if not text:
        return False
    if len(text) < 4 or len(text) > 25:
        return False
    chinese_chars = re.findall(r'[一-鿿]', text)
    if len(chinese_chars) < 3:
        return False
    for keyword in ADDRESS_KEYWORDS:
        if keyword in text:
            return False
    if re.search(r'\d{4,}', text):
        return False
    if text.startswith(("新界", "九龍", "香港")):
        return False
    return True


def extract_chinese_name(soup: BeautifulSoup) -> str | None:
    """Extract Chinese school name from page title."""
    title = soup.find("title")
    if title:
        title_text = title.get_text(strip=True)
        for prefix in ["SSP2025/2026 ", "SSP2025/2026", "PSP2025 ", "PSP2025"]:
            if prefix in title_text:
                name = title_text.replace(prefix, "").strip()
                if is_valid_chinese_name(name):
                    return name

    # Fallback: look in header section
    for tag in ["h1", "h2", "h3"]:
        for elem in soup.find_all(tag):
            text = elem.get_text(strip=True)
            if is_valid_chinese_name(text):
                return text

    return None


def extract_sections(soup: BeautifulSoup) -> dict:
    """Extract content sections from CHSC detail page."""
    sections = {}

    # Get all text content
    page_text = soup.get_text("\n", strip=True)

    # Split by section headers
    current_section = None
    current_content = []

    for line in page_text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Check if this line is a section header
        section_found = False
        for section_name, evidence_type in SECTION_MAP.items():
            if section_name in line and len(line) < 30:
                # Save previous section
                if current_section and current_content:
                    sections[current_section] = "\n".join(current_content)
                # Start new section
                current_section = evidence_type
                current_content = []
                section_found = True
                break

        if not section_found and current_section:
            current_content.append(line)

    # Save last section
    if current_section and current_content:
        sections[current_section] = "\n".join(current_content)

    return sections


def extract_identity(soup: BeautifulSoup) -> dict:
    """Extract identity fields from page."""
    identity = {}
    page_text = soup.get_text("\n", strip=True)

    # Extract fields using regex
    patterns = {
        "address": r"地址[：:]\s*(.+?)(?:\n|電話)",
        "phone": r"電話[：:]\s*(\d[\d\s\-]+)",
        "fax": r"傳真[：:]\s*(\d[\d\s\-]+)",
        "email": r"電郵[：:]\s*(\S+@\S+)",
        "website": r"網址[：:]\s*(https?://\S+)",
        "school_type": r"學校類別[：:]\s*(.+?)(?:\n)",
        "gender": r"學生性別[：:]\s*(.+?)(?:\n)",
        "religion": r"宗教[：:]\s*(.+?)(?:\n)",
        "founded_year": r"創校年份[：:]\s*(\d{4})",
        "motto": r"校訓[：:]\s*(.+?)(?:\n)",
    }

    for key, pattern in patterns.items():
        match = re.search(pattern, page_text, re.MULTILINE)
        if match:
            identity[key] = match.group(1).strip()

    return identity


async def get_school_profile_v2(detail_url: str) -> dict | None:
    """Get comprehensive school profile from detail page."""
    try:
        html = await fetch_page(detail_url)
        soup = BeautifulSoup(html, "html.parser")

        profile = {
            "name_zh": extract_chinese_name(soup),
            "identity": extract_identity(soup),
            "sections": extract_sections(soup),
        }

        return profile

    except Exception as e:
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

    # Step 2: Get comprehensive profiles
    print("\nStep 2: Fetching comprehensive profiles from detail pages...")
    success = 0
    total_evidence = 0

    for i, school in enumerate(all_schools):
        profile = await get_school_profile_v2(school["detail_url"])
        if profile:
            school["profile_v2"] = profile
            success += 1
            if i < 10 or i % 50 == 0:
                sections = list(profile.get("sections", {}).keys())
                print(f"  [{i+1}/{len(all_schools)}] ✓ {school['name_en']}")
                print(f"      ZH: {profile.get('name_zh', 'N/A')}")
                print(f"      Sections: {sections}")
        else:
            if i < 10:
                print(f"  [{i+1}/{len(all_schools)}] ✗ {school['name_en']}")

        if (i + 1) % 100 == 0:
            print(f"  ... Progress: {i+1}/{len(all_schools)} (success={success})")

        await asyncio.sleep(0.2)

    print(f"\nProfiles fetched: {success}/{len(all_schools)}")

    # Step 3: Save to JSON
    with open("/tmp/chsc_profiles_v2.json", "w", encoding="utf-8") as f:
        json.dump(all_schools, f, ensure_ascii=False, indent=2)
    print("Saved to /tmp/chsc_profiles_v2.json")

    # Step 4: Update database
    print("\nStep 4: Updating database...")
    updated = 0
    evidence_count = 0

    for school in all_schools:
        if not school.get("profile_v2"):
            continue

        profile = school["profile_v2"]
        chsc_id = school["sch_id"]

        # Find matching school in database
        rows = await conn.fetch("""
            SELECT school_id
            FROM memory.school_entity
            WHERE source_name = 'chsc_secondary_csv'
            AND canonical_name ILIKE $1
        """, f"%{school['name_en'][:15]}%")

        for row in rows:
            db_school_id = row[0]

            # Update Chinese name if valid
            if profile.get("name_zh"):
                await conn.execute("""
                    UPDATE memory.school_entity
                    SET school_name_zh = $1
                    WHERE school_id = $2
                    AND source_name = 'chsc_secondary_csv'
                """, profile["name_zh"], db_school_id)

            # Insert evidence records
            for section_name, content in profile.get("sections", {}).items():
                if not content or len(content.strip()) < 20:
                    continue

                await conn.execute("""
                    INSERT INTO memory.school_profile_evidence
                    (school_master_id, profile_type, profile_key, profile_value, language, source, source_version, confidence)
                    VALUES (
                        (SELECT school_master_id FROM memory.school_entity_mapping
                         WHERE source_system = 'CHSC' AND source_school_id = $1 LIMIT 1),
                        $2, $3, $4, 'zh-HK', 'CHSC_SSP2025', 'CHSC_SSP2025', 0.95
                    )
                    ON CONFLICT DO NOTHING
                """, db_school_id, section_name, section_name, content.strip())
                evidence_count += 1

            updated += 1
            break

    print(f"Updated {updated} schools")
    print(f"Inserted {evidence_count} evidence records")

    # Verify
    total_evidence = await conn.fetchval("SELECT COUNT(*) FROM memory.school_profile_evidence WHERE source = $1", "CHSC_SSP2025")
    schools_with_evidence = await conn.fetchval("""
        SELECT COUNT(DISTINCT school_master_id)
        FROM memory.school_profile_evidence
        WHERE source = $1
    """, "CHSC_SSP2025")

    print(f"\nTotal evidence records: {total_evidence}")
    print(f"Schools with evidence: {schools_with_evidence}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
