FROM python:3.11-slim

RUN pip install --no-cache-dir httpx fastapi uvicorn

WORKDIR /app
COPY proxy.py .

EXPOSE 18781

ENTRYPOINT ["python3", "proxy.py"]
