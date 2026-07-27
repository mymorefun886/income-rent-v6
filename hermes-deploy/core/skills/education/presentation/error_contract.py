# Phase 10.1.9: Error Contract (FREEZE)
# Standardized error codes for Education Decision Engine.
# All errors follow this contract — Gateway / Telegram / Web / API all use same format.

from dataclasses import dataclass
from typing import Optional


# ── Error Codes (FREEZE) ────────────────────────────────────

ERROR_ENTITY_NOT_FOUND = "ENTITY_NOT_FOUND"
ERROR_NO_RESULTS = "NO_RESULTS"
ERROR_INVALID_QUERY = "INVALID_QUERY"
ERROR_TRACE_FAILED = "TRACE_FAILED"
ERROR_LOCALE_DETECTION_FAILED = "LOCALE_DETECTION_FAILED"
ERROR_KNOWLEDGE_UNAVAILABLE = "KNOWLEDGE_UNAVAILABLE"

# Error code → HTTP status mapping
ERROR_HTTP_STATUS = {
    ERROR_ENTITY_NOT_FOUND: 200,  # Not an error, just no match
    ERROR_NO_RESULTS: 200,  # Empty results, not error
    ERROR_INVALID_QUERY: 400,
    ERROR_TRACE_FAILED: 500,
    ERROR_LOCALE_DETECTION_FAILED: 200,  # Fallback to default
    ERROR_KNOWLEDGE_UNAVAILABLE: 503,
}

# Error code → user-facing message (zh-TW)
ERROR_MESSAGES_ZH = {
    ERROR_ENTITY_NOT_FOUND: "找不到指定的學校名稱，請確認後重新查詢",
    ERROR_NO_RESULTS: "沒有符合條件的學校，建議調整篩選條件",
    ERROR_INVALID_QUERY: "無法理解您的查詢，請用不同方式描述",
    ERROR_TRACE_FAILED: "系統處理中發生錯誤，請稍後再試",
    ERROR_LOCALE_DETECTION_FAILED: "語言偵測失敗，使用預設語言",
    ERROR_KNOWLEDGE_UNAVAILABLE: "知識庫暫時無法使用，請稍後再試",
}

# Error code → user-facing message (en)
ERROR_MESSAGES_EN = {
    ERROR_ENTITY_NOT_FOUND: "Could not find the specified school. Please check and try again.",
    ERROR_NO_RESULTS: "No schools match your criteria. Try broadening your search.",
    ERROR_INVALID_QUERY: "Could not understand your query. Please try different wording.",
    ERROR_TRACE_FAILED: "System error during processing. Please try again later.",
    ERROR_LOCALE_DETECTION_FAILED: "Language detection failed. Using default.",
    ERROR_KNOWLEDGE_UNAVAILABLE: "Knowledge base temporarily unavailable. Please try later.",
}


@dataclass
class EducationError:
    """Standardized error response.

    Contract:
        {
            "success": false,
            "error": {
                "code": "ENTITY_NOT_FOUND",
                "message": "...",
                "locale": "zh-TW"
            }
        }
    """
    code: str
    message: str
    locale: str = "zh-TW"
    details: Optional[dict] = None

    def to_dict(self) -> dict:
        result = {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.message,
                "locale": self.locale,
            }
        }
        if self.details:
            result["error"]["details"] = self.details
        return result

    @classmethod
    def create(cls, code: str, locale: str = "zh-TW", details: dict = None) -> "EducationError":
        """Factory method with localized messages."""
        messages = ERROR_MESSAGES_ZH if locale == "zh-TW" else ERROR_MESSAGES_EN
        message = messages.get(code, "Unknown error")
        return cls(code=code, message=message, locale=locale, details=details)

    @classmethod
    def entity_not_found(cls, entity_name: str, locale: str = "zh-TW") -> "EducationError":
        return cls.create(ERROR_ENTITY_NOT_FOUND, locale, {"entity": entity_name})

    @classmethod
    def no_results(cls, constraints: dict = None, locale: str = "zh-TW") -> "EducationError":
        return cls.create(ERROR_NO_RESULTS, locale, {"constraints": constraints})

    @classmethod
    def invalid_query(cls, query: str, locale: str = "zh-TW") -> "EducationError":
        return cls.create(ERROR_INVALID_QUERY, locale, {"query": query})
