# Hermes Gateway — Configuration

import os

CORE_HOST = os.getenv("CORE_HOST", "hermes-core")
CORE_PORT = os.getenv("CORE_PORT", "8000")
CORE_URL = f"http://{CORE_HOST}:{CORE_PORT}"
