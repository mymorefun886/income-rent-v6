# Hermes Agent — Configuration

import os
from urllib.parse import quote_plus

# Internal services (Docker DNS)
CORE_URL = os.getenv("CORE_URL", "http://hermes-core:8000")
KNOWLEDGE_URL = os.getenv("KNOWLEDGE_URL", "http://hermes-knowledge:8000")
MEMORY_URL = os.getenv("MEMORY_URL", "http://hermes-memory:8000")

# Redis (session store)
REDIS_HOST = os.getenv("REDIS_HOST", "hermes-redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_URL = f"redis://{REDIS_HOST}:{REDIS_PORT}"

# PostgreSQL (task persistence)
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "hermes-postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "hermes")
POSTGRES_USER = os.getenv("POSTGRES_USER", "hermes")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
PG_DSN = f"postgresql://{POSTGRES_USER}:{quote_plus(POSTGRES_PASSWORD)}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

AGENT_SCHEMA = os.getenv("AGENT_SCHEMA", "agent")

# Session TTL (seconds) — 24 hours
SESSION_TTL = int(os.getenv("SESSION_TTL", "86400"))

# Task states
TASK_STATES = ("received", "planning", "executing", "completed", "failed")
