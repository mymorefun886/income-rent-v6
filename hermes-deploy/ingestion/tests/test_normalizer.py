# Tests: School Normalizer
# Covers: district, fees, facilities, subjects, school type, gender normalization.

import json
import pytest
from normalizer import (
    _normalize_district, _normalize_school_type, _normalize_gender,
    _parse_int, _parse_bool, _parse_subject_list, _clean_text,
    normalize_row,
)


class TestCleanText:
    def test_strips_whitespace(self):
        assert _clean_text("  hello  ") == "hello"

    def test_collapses_multiple_spaces(self):
        assert _clean_text("hello   world") == "hello world"

    def test_empty_string(self):
        assert _clean_text("") == ""

    def test_strips_punctuation(self):
        assert _clean_text('"hello".') == "hello"


class TestDistrictNormalize:
    def test_lowercase(self):
        assert _normalize_district("kowloon city") == "Kowloon City"

    def test_mixed_case(self):
        assert _normalize_district("Sha Tin") == "Sha Tin"

    def test_unknown_district_passthrough(self):
        result = _normalize_district("Some New District")
        assert "Some New District" in result

    def test_all_18_districts(self):
        districts = [
            "Central & Western", "Eastern", "Islands", "Kowloon City",
            "Kwai Tsing", "Kwun Tong", "North", "Sai Kung",
            "Sha Tin", "Sham Shui Po", "Southern", "Tai Po",
            "Tsuen Wan", "Tuen Mun", "Wan Chai", "Wong Tai Sin",
            "Yau Tsim Mong", "Yuen Long",
        ]
        for d in districts:
            result = _normalize_district(d.lower())
            assert result == d, f"Expected {d}, got {result}"


class TestSchoolTypeNormalize:
    def test_dss(self):
        assert _normalize_school_type("DSS") == "DSS"
        assert _normalize_school_type("direct subsidy scheme") == "DSS"

    def test_aided(self):
        assert _normalize_school_type("AIDED") == "Aided"

    def test_government(self):
        assert _normalize_school_type("Government") == "Government"

    def test_private(self):
        assert _normalize_school_type("Private") == "Private"

    def test_caput(self):
        assert _normalize_school_type("Caput") == "Caput"


class TestGenderNormalize:
    def test_coed(self):
        assert _normalize_gender("Co-Ed") == "Co-ed"

    def test_boys(self):
        assert _normalize_gender("BOYS") == "Boys"

    def test_girls(self):
        assert _normalize_gender("Girls") == "Girls"


class TestParseInt:
    def test_simple(self):
        assert _parse_int("123") == 123

    def test_with_commas(self):
        assert _parse_int("25,000") == 25000

    def test_na(self):
        assert _parse_int("N/A") is None
        assert _parse_int("-") is None
        assert _parse_int("") is None

    def test_zero(self):
        assert _parse_int("0") == 0


class TestParseBool:
    def test_yes(self):
        assert _parse_bool("Yes") is True
        assert _parse_bool("yes") is True

    def test_no(self):
        assert _parse_bool("No") is False
        assert _parse_bool("") is False


class TestParseSubjectList:
    def test_semicolon_separated(self):
        result = _parse_subject_list("Biology; Chemistry; Physics")
        assert result == ["Biology", "Chemistry", "Physics"]

    def test_single(self):
        result = _parse_subject_list("Mathematics")
        assert result == ["Mathematics"]

    def test_empty(self):
        assert _parse_subject_list("") == []
        assert _parse_subject_list("N/A") == []

    def test_sorted(self):
        result = _parse_subject_list("Physics; Biology; Chemistry")
        assert result == ["Biology", "Chemistry", "Physics"]


class TestNormalizeRow:
    def _make_row(self, **overrides):
        """Build a minimal 104-element CSV row."""
        row = [""] * 104
        # Default: Diocesan Boys' School, Kowloon City, DSS, Boys
        row[0] = "Kowloon City"
        row[1] = "Diocesan Boys' School"
        row[2] = "131 Argyle Street"
        row[3] = "27115191"
        row[4] = "https://www.dbs.edu.hk"
        row[13] = "DSS"
        row[14] = "Boys"
        row[18] = "Sheng Kung Hui"
        row[19] = "Christian"
        row[53] = "52500"
        row[54] = "52500"
        row[59] = "Yes"
        row[60] = "Yes"
        row[61] = "No"
        row[39] = "Biology; Chemistry; Physics"
        row[78] = "English as medium of instruction"
        row[79] = "Student-centered learning"
        # Apply overrides
        for idx, val in overrides.items():
            row[idx] = val
        # Convert to dict with string keys for positional access
        return {str(i): v for i, v in enumerate(row)}

    def test_basic_entity_fields(self):
        row = self._make_row()
        entity, attrs = normalize_row(row)
        assert entity["canonical_name"] == "Diocesan Boys' School"
        assert entity["district"] == "Kowloon City"
        assert entity["school_type"] == "DSS"
        assert entity["student_gender"] == "Boys"

    def test_fees_parsed(self):
        row = self._make_row()
        _, attrs = normalize_row(row)
        fees_s1 = next(a for a in attrs if a.attr_key == "fees_s1")
        assert fees_s1.attr_value == "52500"

    def test_fees_empty_skipped(self):
        row = self._make_row(**{53: "N/A"})
        _, attrs = normalize_row(row)
        fee_attrs = [a for a in attrs if a.attr_key == "fees_s1"]
        assert len(fee_attrs) == 0

    def test_facilities_boolean(self):
        row = self._make_row()
        _, attrs = normalize_row(row)
        lib = next(a for a in attrs if a.attr_key == "facility_library")
        playground = next(a for a in attrs if a.attr_key == "facility_playground")
        assert lib.attr_value == "true"
        assert playground.attr_value == "false"

    def test_subjects_parsed(self):
        row = self._make_row()
        _, attrs = normalize_row(row)
        subj = next(a for a in attrs if a.attr_key == "subjects_s4_s6_english")
        parsed = json.loads(subj.attr_value)
        assert "Biology" in parsed
        assert "Chemistry" in parsed

    def test_academic_signals_generated(self):
        row = self._make_row()
        _, attrs = normalize_row(row)
        signal_keys = {a.attr_key for a in attrs if a.attr_key.startswith("academic_signal_")}
        assert "academic_signal_language_strength" in signal_keys
        assert "academic_signal_science_availability" in signal_keys
        assert "academic_signal_subject_breadth" in signal_keys

    def test_academic_signal_science_high(self):
        row = self._make_row(**{39: "Biology; Chemistry; Physics; Mathematics"})
        _, attrs = normalize_row(row)
        signal = next(a for a in attrs if a.attr_key == "academic_signal_science_availability")
        assert signal.attr_value == "high"

    def test_academic_signal_language_strong_dss(self):
        row = self._make_row(**{13: "DSS", 39: ""})
        _, attrs = normalize_row(row)
        signal = next(a for a in attrs if a.attr_key == "academic_signal_language_strength")
        assert signal.attr_value == "high"

    def test_language_policy_preserved(self):
        row = self._make_row()
        _, attrs = normalize_row(row)
        lp = next(a for a in attrs if a.attr_key == "language_policy")
        assert "English" in lp.attr_value

    def test_website_normalized(self):
        row = self._make_row(**{4: "www.dbs.edu.hk"})
        _, attrs = normalize_row(row)
        website = next(a for a in attrs if a.attr_key == "website")
        assert website.attr_value.startswith("https://")

    def test_tel_digits_only(self):
        row = self._make_row(**{3: "(852) 2711-5191"})
        _, attrs = normalize_row(row)
        tel = next(a for a in attrs if a.attr_key == "tel")
        assert tel.attr_value == "85227115191"
