#!/bin/bash
# Hermes OS — Daily Backup Script
# Schedule: daily cron on NAS
# Location: /volume3/hermes/scripts/backup.sh

BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_DIR=/volume1/hermes-cold/backups

echo "[$(date)] Starting daily backup..."

# PostgreSQL
echo "  Dumping PostgreSQL..."
docker exec hermes-postgres pg_dump -U hermes hermes > "$BACKUP_DIR/postgres/daily/hermes_$BACKUP_DATE.sql" 2>&1
gzip "$BACKUP_DIR/postgres/daily/hermes_$BACKUP_DATE.sql"

# Qdrant
echo "  Creating Qdrant snapshot..."
curl -s -X POST "localhost:6333/snapshots" -H "Content-Type: application/json" -d '{"name": "hermes_'$BACKUP_DATE'"}'

# Configs
echo "  Backing up configs..."
cp /volume3/hermes/deploy/.env "$BACKUP_DIR/env/.env_$BACKUP_DATE"
cp /volume3/hermes/deploy/docker-compose.yml "$BACKUP_DIR/docker-compose/docker-compose_$BACKUP_DATE.yml"

# Keep only last 7 days of daily backups
find "$BACKUP_DIR/postgres/daily" -name "*.gz" -mtime +7 -delete 2>/dev/null
find "$BACKUP_DIR/env" -name ".env_*" -mtime +7 -delete 2>/dev/null
find "$BACKUP_DIR/docker-compose" -name "*.yml" -mtime +7 -delete 2>/dev/null

echo "[$(date)] Backup complete."
