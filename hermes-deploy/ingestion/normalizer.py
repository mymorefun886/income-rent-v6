# Hermes Ingestion — School Normalizer
# Converts raw CHSC CSV rows to normalized school_entity + school_attributes.
# Accesses row dict by CSV column NAME (not index) — JSONB round-trip safe.

import json
import logging
import re
from typing import Any

from models import SchoolAttribute

logger = logging.getLogger("hermes.ingestion.normalizer")

# CHSC CSV column NAME → (attr_key, attr_group)
# Column names from ssp_2025_2026_en.csv header (103 columns)

COLUMN_MAP: dict[str, tuple[str, str]] = {
    "district": ("district", "identity"),
    "school_name": ("canonical_name", "identity"),
    "school_address": ("address", "identity"),
    "school_tel": ("tel", "identity"),
    "school_website": ("website", "identity"),
    "school_email": ("email", "identity"),
    "school_fax": ("fax", "identity"),
    "name_of_principal": ("principal_name", "identity"),
    "name_supervisor_chairman_of_mc": ("school_supervisor", "identity"),
    "commencement_of_operation_year": ("year_founded", "identity"),
    "sponsoring_body": ("sponsoring_body_type", "identity"),
    "school_mission": ("mission", "identity"),
    "school_type": ("school_type", "identity"),
    "student_gender": ("student_gender", "identity"),
    "school_size": ("school_size", "identity"),
    "religion": ("religion", "identity"),
    "school_motto": ("school_motto", "identity"),
    # Subject offerings (2025-2026)
    "2025_2026_subject_offered_by_chinese_s1_to_s3": ("subjects_s1_s3_chinese", "academic"),
    "2025_2026_subject_offered_by_english_s1_to_s3": ("subjects_s1_s3_english", "academic"),
    "2025_2026_subject_offered_others_s1_to_s3": ("subjects_s1_s3_others", "academic"),
    "2025_2026_subject_offered_by_chinese_s4_to_s6": ("subjects_s4_s6_chinese", "academic"),
    "2025_2026_subject_offered_by_english_s4_to_s6": ("subjects_s4_s6_english", "academic"),
    "2025_2026_subject_offered_others_s4_to_s6": ("subjects_s4_s6_others", "academic"),
    # Elective subjects (2026-2027)
    "2026_2027_subject_offered_by_chinese_s1_to_s3": ("elective_subjects_s1_s3_chinese", "academic"),
    "2026_2027_subject_offered_by_english_s1_to_s3": ("elective_subjects_s1_s3_english", "academic"),
    "2026_2027_subject_offered_others_s1_to_s3": ("elective_subjects_s1_s3_others", "academic"),
    "2026_2027_subject_offered_by_chinese_s4_to_s6": ("elective_subjects_s4_s6_chinese", "academic"),
    "2026_2027_subject_offered_by_english_s4_to_s6": ("elective_subjects_s4_s6_english", "academic"),
    "2026_2027_subject_offered_others_s4_to_s6": ("elective_subjects_s4_s6_others", "academic"),
    # Class counts
    "current_year_no_of_class_s1": ("classes_s1", "academic"),
    "current_year_no_of_class_s2": ("classes_s2", "academic"),
    "current_year_no_of_class_s3": ("classes_s3", "academic"),
    "current_year_no_of_class_s4": ("classes_s4", "academic"),
    "current_year_no_of_class_s5": ("classes_s5", "academic"),
    "current_year_no_of_class_s6": ("classes_s6", "academic"),
    # Teacher stats
    "tsi_total_no_of_teachers": ("teacher_count", "academic"),
    "tsi_no_of_approved_teaching_posts": ("approved_teaching_posts", "academic"),
    "tsi_percent_of_received_teacher_training": ("pct_teacher_training", "academic"),
    "tsi_percent_of_bachelor": ("pct_bachelor", "academic"),
    "tsi_percent_of_master_doctorate_or_above": ("pct_master_or_above", "academic"),
    "tsi_percent_of_special_edu_training": ("pct_special_edu_training", "academic"),
    "tsi_percent_of_exp_0_4": ("pct_exp_0_4_years", "academic"),
    "tsi_percent_of_exp_5_9": ("pct_exp_5_9_years", "academic"),
    "tsi_percent_of_exp_10_or_above": ("pct_exp_10_or_above", "academic"),
    # Fees
    "sc_school_fee_s1": ("fees_s1", "fees"),
    "sc_school_fee_s2": ("fees_s2", "fees"),
    "sc_school_fee_s3": ("fees_s3", "fees"),
    "sc_school_fee_s4": ("fees_s4", "fees"),
    "sc_school_fee_s5": ("fees_s5", "fees"),
    "sc_school_fee_s6": ("fees_s6", "fees"),
    "sc_tong_fai_s1": ("tong_fai_s1", "fees"),
    "sc_tong_fai_s2": ("tong_fai_s2", "fees"),
    "sc_tong_fai_s3": ("tong_fai_s3", "fees"),
    "sc_tong_fai_s4": ("tong_fai_s4", "fees"),
    "sc_tong_fai_s5": ("tong_fai_s5", "fees"),
    "sc_tong_fai_s6": ("tong_fai_s6", "fees"),
    # Policies
    "language_policy": ("language_policy", "policies"),
    "learning_and_teaching_strategies": ("learning_strategies", "policies"),
    "school_based_curriculum": ("school_based_curriculum", "policies"),
    "school_green_policy": ("green_policy", "policies"),
    # Student development
    "life_planning_education": ("career_guidance", "student_dev"),
    "whole_school_approach_cater_for_learner_diversity": ("student_support", "student_dev"),
    "whole_school_approach_integrated_education": ("integrated_education", "student_dev"),
    "support_for_non_chinese_students": ("ncs_support", "student_dev"),
    "school_ethos": ("school_ethos", "student_dev"),
    # Home-school cooperation
    "home_school_co_operation": ("home_school_cooperation", "student_dev"),
    "parent_teacher_association": ("pta", "student_dev"),
    "school_alumni_association": ("alumni_association", "student_dev"),
    # Facilities (text field — parsed below)
    "fac_school_facilities": ("facility_list", "facilities"),
    "fac_no_of_classroom": ("classroom_count", "facilities"),
    "fac_facility_for_special_educational_needs": ("sen_facilities", "facilities"),
    # Other
    "school_dev_plan": ("development_plan", "school_info"),
    "school_major_concerns": ("major_concerns", "school_info"),
    "school_organisation": ("school_organisation", "school_info"),
    "life_wide_learning": ("life_wide_learning", "school_info"),
    "teacher_pro_training_and_dev": ("teacher_dev", "school_info"),
    "direct_public_transportation_to_school": ("public_transport", "school_info"),
    "fee_remission": ("fee_remission", "fees"),
}

# Known facility keywords to extract from the fac_school_facilities text blob
FACILITY_KEYWORDS = [
    "Library", "School Hall", "Playground", "STEM Room",
    "Self-study Room", "Career Resource Room", "Student Activity Room",
    "Music Room", "Art Room", "Computer Room", "Computer Laboratory",
    "Home Economics Room", "Design and Technology Room",
    "Visual Arts Room", "Language Room", "Language Laboratory",
    "Geography Room", "Science Laboratory", "Biology Laboratory",
    "Chemistry Laboratory", "Physics Laboratory",
    "Swimming Pool", "Gymnasium", "Basketball Court", "Football Field",
    "Tuck Shop", "Chapel", "Canteen", "Lecture Theatre",
    "Multi-media Room", "Campus TV", "Greenhouse", "English Corner",
    "Counselling Room", "Multi-purpose Room", "Dance Room",
    "Fitness Room", "Covered Playground", "Outdoor Playground",
    "Medical Room", "Student Centre", "Conference Room",
    "IT Learning Centre", "Innovation Centre", "Robotics Lab",
]

# 18 districts normalized
DISTRICT_MAP = {
    "central & western": "Central & Western",
    "central and western": "Central & Western",
    "central western": "Central & Western",
    "eastern": "Eastern",
    "islands": "Islands",
    "kowloon city": "Kowloon City",
    "kwai tsing": "Kwai Tsing",
    "kwun tong": "Kwun Tong",
    "north": "North",
    "sai kung": "Sai Kung",
    "sha tin": "Sha Tin",
    "sham shui po": "Sham Shui Po",
    "southern": "Southern",
    "tai po": "Tai Po",
    "tsuen wan": "Tsuen Wan",
    "tuen mun": "Tuen Mun",
    "wan chai": "Wan Chai",
    "wong tai sin": "Wong Tai Sin",
    "yau tsim mong": "Yau Tsim Mong",
    "yuen long": "Yuen Long",
}

SCHOOL_TYPE_MAP = {
    "aided": "Aided",
    "government": "Government",
    "gov't": "Government",
    "dss": "DSS",
    "direct subsidy scheme": "DSS",
    "private": "Private",
    "caput": "Caput",
}

GENDER_MAP = {
    "co-ed": "Co-ed",
    "co-educational": "Co-ed",
    "boys": "Boys",
    "girls": "Girls",
}


def _clean_text(val: str) -> str:
    """Strip whitespace, collapse multiple spaces, remove leading/trailing punctuation."""
    if not val:
        return ""
    val = " ".join(val.split())
    val = val.strip(".,;: \"'")
    return val


def _normalize_district(val: str) -> str:
    key = _clean_text(val).lower()
    return DISTRICT_MAP.get(key, _clean_text(val).title())


def _normalize_school_type(val: str) -> str:
    key = _clean_text(val).lower()
    return SCHOOL_TYPE_MAP.get(key, _clean_text(val))


def _normalize_gender(val: str) -> str:
    key = _clean_text(val).lower()
    return GENDER_MAP.get(key, _clean_text(val))


def _parse_int(val: str) -> int | None:
    """Parse integer from CSV value. Returns None for empty/N/A."""
    if not val or val.strip().upper() in ("N/A", "-", ""):
        return None
    try:
        val = val.replace(",", "").replace("$", "").replace("%", "")
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _parse_bool(val: str) -> bool:
    """Parse Yes/No boolean from CSV value."""
    if not val:
        return False
    return val.strip().lower() in ("yes", "y", "true", "1", "t")


def _parse_subject_list(val: str) -> list[str]:
    """Parse comma or newline separated subject list."""
    if not val or val.strip().upper() in ("N/A", "-", ""):
        return []
    parts = re.split(r'[,;\n]+', val)
    result = []
    for p in parts:
        p = p.strip().strip('"').strip("'")
        if p and p.upper() not in ("N/A", "-"):
            result.append(p)
    return result


def _parse_facilities(val: str) -> list[str]:
    """Parse facility text blob into individual facility flags."""
    if not val:
        return []
    found = []
    val_lower = val.lower()
    for keyword in FACILITY_KEYWORDS:
        if keyword.lower() in val_lower:
            found.append(keyword)
    return found


def _derive_academic_signals(attrs: dict[str, Any]) -> list[SchoolAttribute]:
    """Derive academic signals from CHSC evidence only. Confidence tied to data source."""
    signals = []
    school_type = attrs.get("school_type", "")

    # Signal 1: Language strength
    english_subjects = len(attrs.get("subjects_s4_s6_english", []))
    if school_type == "DSS" or english_subjects >= 5:
        lang_strength = "high"
        lang_confidence = 0.85
    elif english_subjects >= 3:
        lang_strength = "standard"
        lang_confidence = 0.75
    else:
        lang_strength = "low"
        lang_confidence = 0.7

    signals.append(SchoolAttribute(
        school_id="",
        attr_key="academic_signal_language_strength",
        attr_value=lang_strength,
        attr_group="academic_signal",
    ))

    # Signal 2: Science availability
    eng_s4 = attrs.get("subjects_s4_s6_english", [])
    chn_s4 = attrs.get("subjects_s4_s6_chinese", [])
    all_s4 = " ".join(eng_s4 + chn_s4).lower()
    has_bio = "biology" in all_s4
    has_chem = "chemistry" in all_s4
    has_phy = "physics" in all_s4

    if has_bio and has_chem and has_phy:
        sci = "high"
        sci_conf = 0.9
    elif (has_bio and has_chem) or (has_chem and has_phy):
        sci = "standard"
        sci_conf = 0.8
    else:
        sci = "low"
        sci_conf = 0.7

    signals.append(SchoolAttribute(
        school_id="",
        attr_key="academic_signal_science_availability",
        attr_value=sci,
        attr_group="academic_signal",
    ))

    # Signal 3: Subject breadth
    all_subjects = set()
    for key in attrs:
        if "subject" in key.lower() and isinstance(attrs[key], list):
            all_subjects.update(s.lower() for s in attrs[key])
    breadth = len(all_subjects)
    if breadth >= 20:
        breadth_val = "high"
    elif breadth >= 12:
        breadth_val = "standard"
    else:
        breadth_val = "low"

    signals.append(SchoolAttribute(
        school_id="",
        attr_key="academic_signal_subject_breadth",
        attr_value=breadth_val,
        attr_group="academic_signal",
    ))

    return signals


def normalize_row(row: dict) -> tuple[dict, list[SchoolAttribute]]:
    """Normalize a single raw CSV row dict to entity fields + attributes.

    Accesses row by CSV column NAME — safe for both csv.DictReader (ordered)
    and JSONB round-tripped dicts (alphabetically reordered).
    """
    entity = {
        "district": _normalize_district(row.get("district", "")),
        "canonical_name": _clean_text(row.get("school_name", "")),
        "school_type": _normalize_school_type(row.get("school_type", "")),
        "student_gender": _normalize_gender(row.get("student_gender", "")),
    }

    attrs: list[SchoolAttribute] = []
    attrs_by_key: dict[str, Any] = {}

    for csv_col, (attr_key, attr_group) in COLUMN_MAP.items():
        val = row.get(csv_col, "")
        if not val:
            continue

        # Skip entity-level fields already handled above
        if attr_key in ("canonical_name", "district", "school_type", "student_gender"):
            continue

        # Skip N/A values
        if isinstance(val, str) and val.strip().upper() in ("N/A", "-", ""):
            continue

        if attr_key in ("tel", "fax"):
            val = re.sub(r"[^\d+]", "", val)
        elif attr_key == "website":
            val = val.lower().strip()
            if val and not val.startswith("http"):
                val = f"https://{val}"
        elif attr_key == "email":
            val = val.lower().strip()
        elif attr_key == "religion":
            val = _clean_text(val).title()
        elif attr_key.startswith("classes_") or attr_key == "teacher_count" or attr_key == "year_founded":
            parsed = _parse_int(val)
            if parsed is None:
                continue
            val = str(parsed)
        elif attr_key.startswith("fees_") or attr_key.startswith("tong_fai_"):
            parsed = _parse_int(val)
            if parsed is None:
                continue
            val = str(parsed)
        elif attr_key.startswith("pct_"):
            parsed = _parse_int(val)
            if parsed is None:
                continue
            val = str(parsed)
        elif attr_key.startswith("subjects_") or attr_key.startswith("elective_"):
            parsed_list = _parse_subject_list(val)
            if not parsed_list:
                continue
            attrs_by_key[attr_key] = parsed_list
            val = json.dumps(parsed_list)
        elif attr_key in ("language_policy", "learning_strategies", "school_based_curriculum",
                          "mission", "school_ethos", "student_support", "integrated_education",
                          "ncs_support", "career_guidance", "home_school_cooperation",
                          "sponsoring_body_type", "school_organisation", "major_concerns",
                          "development_plan", "life_wide_learning", "teacher_dev",
                          "green_policy", "public_transport", "fee_remission",
                          "pta", "alumni_association", "school_motto", "principal_name",
                          "school_supervisor", "address", "classroom_count", "sen_facilities",
                          "approved_teaching_posts"):
            val = _clean_text(val)
        elif attr_key == "facility_list":
            # Parse facility text blob into individual boolean attributes
            facilities = _parse_facilities(val)
            for fac_name in facilities:
                key = f"facility_{fac_name.lower().replace(' ', '_').replace('-', '_')}"
                attrs.append(SchoolAttribute(
                    school_id="",
                    attr_key=key,
                    attr_value="true",
                    attr_group="facilities",
                ))
            # Also store the raw facility text
            val = _clean_text(val)

        attrs.append(SchoolAttribute(
            school_id="",
            attr_key=attr_key,
            attr_value=str(val),
            attr_group=attr_group,
        ))

    # Academic signals
    combined_attrs = attrs_by_key.copy()
    combined_attrs["school_type"] = entity.get("school_type", "")
    signals = _derive_academic_signals(combined_attrs)
    attrs.extend(signals)

    return entity, attrs
