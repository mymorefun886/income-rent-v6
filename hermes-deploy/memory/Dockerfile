# Hermes Memory Service — Dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 hermes && chown -R hermes:hermes /app
USER hermes

EXPOSE 8000
CMD ["python", "main.py"]
