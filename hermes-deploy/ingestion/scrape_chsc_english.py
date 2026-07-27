#!/usr/bin/env python3
"""
CHSC Profile English Version Scraper
Scrapes English version of CHSC profiles and adds to evidence table.
"""

import asyncio
import json
import re
import sys

import asyncpg
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://www.chsc.hk/ssp2025/"

# English section mapping
EN_SECTION_MAP = {
    "School Mission": "mission",
    "School Motto": "motto",
    "School Management": "school_management",
    "Teaching and Learning": "teaching_planning",
    "Assessment": "assessment",
    "School Life": "school_life",
    "Life-wide Learning": "life_wide_learning",
    "Student Support": "student_support",
    "Teacher Information": "teacher_profile",
    "Class Structure": "class_structure",
    "School Facilities": "facilities",
    "Extra-curricular Activities": "activities",
    "School Ethos": "ethos",
    "Special Features": "special_features",
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


def extract_english_name(soup: BeautifulSoup) -> str | None:
    """Extract English school name from page."""
    # Try title first
    title = soup.find("title")
    if title:
        title_text = title.get_text(strip=True)
        # English title format: "Buddhist Sin Tak College - SSP2025/2026"
        match = re.search(r'(.+?)\s*[-–]\s*SSP\d{4}', title_text)
        if match:
            return match.group(1).strip()

    # Fallback: look in header
    for tag in ["h1", "h2", "h3"]:
        for elem in soup.find_all(tag):
            text = elem.get_text(strip=True)
            if re.search(r'[a-zA-Z]{5,}', text) and not re.search(r'[一-鿿]', text):
                return text
    return None


def extract_english_sections(soup: BeautifulSoup) -> dict:
    """Extract content sections from English CHSC detail page."""
    sections = {}
    page_text = soup.get_text("\n", strip=True)

    current_section = None
    current_content = []

    for line in page_text.split("\n"):
        line = line.strip()
        if not line:
            continue

        # Check if this line is a section header
        section_found = False
        for section_name, evidence_type in EN_SECTION_MAP.items():
            if section_name.lower() in line.lower() and len(line) < 40:
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


async def main():
    conn = await asyncpg.connect(
        host="hermes-postgres",
        database="hermes",
        user="hermes",
        password="biyz5Buh8AMX_2C90@+fLFPM"
    )

    # Get all CHSC schools with mappings
    schools = await conn.fetch("""
        SELECT e.school_id, e.canonical_name, m.school_master_id
        FROM memory.school_entity e
        JOIN memory.school_entity_mapping m ON e.school_id = m.source_school_id
        WHERE e.source_name = 'chsc_secondary_csv'
        AND m.source_system = 'CHSC'
    """)

    print(f"Schools to process: {len(schools)}")

    # Process each school
    success = 0
    evidence_count = 0

    for i, school in enumerate(schools):
        sch_id = school[0]
        name_en = school[1]
        master_id = school[2]

        # Construct English URL
        # Replace lang_id=2 with lang_id=1 in the detail URL
        url = f"{BASE_URL}sch_detail.php?li_id=2&lang_id=1&chg_district_id=1&sch_id={sch_id}&return_page=sch_list.php%3Flang_id%3D1%26chg_district_id%3D1%26search_mode%3D%26frmMode%3Dpagebreak%26sort_id%3D-1"

        try:
            html = await fetch_page(url)
            soup = BeautifulSoup(html, "html.parser")

            # Extract sections
            sections = extract_english_sections(soup)

            if not sections:
                if i < 10:
                    print(f"  [{i+1}/{len(schools)}] ✗ {name_en} - No sections found")
                continue

            # Insert evidence records
            for section_name, content in sections.items():
                if not content or len(content.strip()) < 20:
                    continue

                await conn.execute("""
                    INSERT INTO memory.school_profile_evidence
                    (school_master_id, profile_type, profile_key, profile_value, language, source, source_version, confidence)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT DO NOTHING
                """,
                    master_id,
                    section_name,
                    section_name,
                    content.strip(),
                    "en",
                    "CHSC_SSP2025",
                    "CHSC_SSP2025",
                    0.95
                )
                evidence_count += 1

            success += 1
            if i < 10 or i % 50 == 0:
                print(f"  [{i+1}/{len(schools)}] ✓ {name_en}")
                print(f"      Sections: {list(sections.keys())}")

        except Exception as e:
            if i < 10:
                print(f"  [{i+1}/{len(schools)}] ✗ {name_en} - Error: {e}")

        if (i + 1) % 100 == 0:
            print(f"  ... Progress: {i+1}/{len(schools)} (success={success})")

        await asyncio.sleep(0.2)

    print(f"\nEnglish profiles processed: {success}/{len(schools)}")
    print(f"English evidence records inserted: {evidence_count}")

    # Verify
    en_count = await conn.fetchval("SELECT COUNT(*) FROM memory.school_profile_evidence WHERE language = 'en'")
    zh_count = await conn.fetchval("SELECT COUNT(*) FROM memory.school_profile_evidence WHERE language = 'zh-HK'")
    print(f"\nTotal evidence: zh-HK={zh_count}, en={en_count}")

    await conn.close()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
