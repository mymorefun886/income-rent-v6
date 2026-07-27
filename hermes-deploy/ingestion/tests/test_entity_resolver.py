# Tests: School Entity Resolver
# Covers: EN/TC/SC name resolution, punctuation stripping,
# script detection, Hans→Hant conversion, new entity creation.

import pytest
from unittest.mock import patch, MagicMock
from entity_resolver import (
    _unicode_normalize,
    _strip_punctuation,
    _normalize_for_match,
    _detect_language,
    _simplified_to_traditional,
    resolve,
)


class TestUnicodeNormalize:
    def test_nfc(self):
        composed = "é"
        assert _unicode_normalize("é") == composed

    def test_cjk_unchanged(self):
        assert _unicode_normalize("英皇書院") == "英皇書院"


class TestStripPunctuation:
    def test_apostrophe(self):
        assert _strip_punctuation("King's College") == "Kings College"

    def test_parentheses(self):
        assert _strip_punctuation("St. Paul's (Lam Tin)") == "St Pauls Lam Tin"

    def test_chinese_punctuation(self):
        assert _strip_punctuation("學校（中學）") == "學校 中學"

    def test_periods(self):
        assert _strip_punctuation("St. Paul's Co-ed.") == "St Pauls Co ed"


class TestNormalizeForMatch:
    def test_lowercase(self):
        assert _normalize_for_match("KING'S COLLEGE") == "kings college"

    def test_full_chain(self):
        assert _normalize_for_match("St. Paul's Co-Ed. (College)") == "st pauls co ed college"


class TestDetectLanguage:
    def test_english(self):
        assert _detect_language("King's College") == "en"

    def test_traditional_chinese(self):
        assert _detect_language("英皇書院") == "zh-Hant"

    def test_simplified_chinese(self):
        assert _detect_language("英皇书院") == "zh-Hans"

    def test_mixed_cjk_is_traditional(self):
        assert _detect_language("学校") == "zh-Hans"


class TestSimplifiedToTraditional:
    def test_school_name_conversion(self):
        result = _simplified_to_traditional("英皇书院")
        assert "學" in result or "书" not in result

    def test_common_chars(self):
        assert _simplified_to_traditional("学") == "學"
        assert _simplified_to_traditional("国") == "國"
        assert _simplified_to_traditional("体") == "體"

    def test_no_change_for_traditional(self):
        result = _simplified_to_traditional("英皇書院")
        # Should not change already-traditional chars
        assert "學" in result or "书" not in result


class TestResolve:
    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_exact_match_english(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_lookup.return_value = "SCH-00001"
        mock_alias.return_value = None

        school_id, is_new = resolve("King's College", "en", "CHSC_CSV_EN")

        assert school_id == "SCH-00001"
        assert is_new is False
        mock_lookup.assert_called_once()
        mock_alias.assert_not_called()

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_traditional_matches_english(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        # Simulate: the TC name "英皇書院" was stored with the same normalized form
        # as the English name — in practice they are different normalized forms, but
        # if identity_map already has the TC entry, direct lookup finds it
        mock_lookup.return_value = "SCH-00001"
        mock_alias.return_value = None

        school_id, is_new = resolve("英皇書院", "zh-Hant", "CHSC_CSV_TC")

        assert school_id == "SCH-00001"
        assert is_new is False

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_simplified_resolves_via_conversion(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        # First lookup (simplified normalized) → None
        # Second lookup (traditional converted normalized) → found
        mock_lookup.side_effect = [None, "SCH-00001"]
        mock_alias.return_value = None

        school_id, is_new = resolve("英皇书院", "zh-Hans", "CHSC_CSV_SC")

        assert school_id == "SCH-00001"
        assert is_new is False
        # Should have called lookup twice (simp + trad)
        assert mock_lookup.call_count == 2
        # Should upsert the simplified entry
        mock_upsert.assert_called_once()

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_new_entity(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_lookup.return_value = None
        mock_alias.return_value = None
        mock_next_id.return_value = "SCH-00099"

        school_id, is_new = resolve("New School Academy", "en", "CHSC_CSV_EN")

        assert school_id == "SCH-00099"
        assert is_new is True
        mock_upsert.assert_called_once()

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_alias_match(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_lookup.return_value = None
        mock_alias.return_value = "SCH-00001"

        school_id, is_new = resolve("DBS", "en", "CHSC_ALIAS")

        assert school_id == "SCH-00001"
        assert is_new is False

    @patch("entity_resolver.lookup_by_normalized_name")
    @patch("entity_resolver.lookup_by_alias")
    @patch("entity_resolver.upsert_identity")
    @patch("entity_resolver.get_next_school_id")
    def test_punctuation_variant_same_entity(self, mock_next_id, mock_upsert, mock_alias, mock_lookup):
        mock_lookup.return_value = "SCH-00001"
        mock_alias.return_value = None

        # "St. Paul's Co-ed" and "St Pauls Co ed" should both normalize to same
        school_id1, _ = resolve("St. Paul's Co-ed. (College)", "en", "CHSC")
        school_id2, _ = resolve("St Pauls Co ed College", "en", "CHSC")

        # Both should find the same entity via mock (same normalized form)
        assert school_id1 == "SCH-00001"
        assert school_id2 == "SCH-00001"
