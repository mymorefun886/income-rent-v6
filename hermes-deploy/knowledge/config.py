# Hermes Knowledge — Configuration

import os

QDRANT_HOST = os.getenv("QDRANT_HOST", "hermes-qdrant")
QDRANT_PORT = os.getenv("QDRANT_PORT", "6333")
QDRANT_URL = f"http://{QDRANT_HOST}:{QDRANT_PORT}"

VECTOR_SIZE = int(os.getenv("VECTOR_SIZE", "768"))

# Domain → collection mapping (keeps vectors isolated per domain)
# Education version controlled by KNOWLEDGE_EDUCATION_VERSION env var.
#   "v1" = demo data (8 schools, development)
#   "v2" = CHSC production data (Phase 10.1)
#   Default: "v1" for backward compatibility. Switch to "v2" after Phase 10.1 validation.
_EDUCATION_VERSION = os.getenv("KNOWLEDGE_EDUCATION_VERSION", "v1")
_EDUCATION_COLLECTION = f"knowledge_education_{_EDUCATION_VERSION}"

DOMAIN_COLLECTIONS = {
    "education": _EDUCATION_COLLECTION,
    "commerce": "knowledge_commerce_v1",
    "investment": "knowledge_investment_v1",
    "personal": "knowledge_personal_v1",
}

# Default collection for unmatched domains
DEFAULT_COLLECTION = "knowledge_general_v1"

def collection_for(domain: str) -> str:
    return DOMAIN_COLLECTIONS.get(domain, DEFAULT_COLLECTION)

def education_version() -> str:
    return _EDUCATION_VERSION
