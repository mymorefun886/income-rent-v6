FROM python:3.11-slim

RUN pip install --no-cache-dir httpx

WORKDIR /app
COPY bridge.py .

EXPOSE 18780

ENTRYPOINT ["python3", "bridge.py"]
