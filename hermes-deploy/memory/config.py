# Hermes Memory Service — Configuration

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

MEMORY_SCHEMA = os.getenv("MEMORY_SCHEMA", "memory")

# DB connection strings
from urllib.parse import quote_plus

PG_DSN = f"postgresql://{POSTGRES_USER}:{quote_plus(POSTGRES_PASSWORD)}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
QDRANT_URL = f"http://{QDRANT_HOST}:{QDRANT_PORT}"
