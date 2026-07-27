# Hermes Core — Configuration
# Reads from environment variables (Docker DNS names)

import os

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "hermes-postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "hermes")
POSTGRES_USER = os.getenv("POSTGRES_USER", "hermes")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

QDRANT_HOST = os.getenv("QDRANT_HOST", "hermes-qdrant")
QDRANT_PORT = os.getenv("QDRANT_PORT", "6333")

REDIS_HOST = os.getenv("REDIS_HOST", "hermes-redis")
REDIS_PORT = os.getenv("REDIS_PORT", "6379")

MEMORY_HOST = os.getenv("MEMORY_HOST", "hermes-memory")
MEMORY_PORT = os.getenv("MEMORY_PORT", "8000")

LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
