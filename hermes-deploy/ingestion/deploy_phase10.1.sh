#!/bin/bash
# ===========================================================================
# Hermes OS Phase 10.1 — Deployment Script (7 Gates)
# Run from NAS host terminal. Idempotent — safe to re-run.
#
# Usage:
#   bash deploy_phase10.1.sh                  # All gates
#   bash deploy_phase10.1.sh --until 3        # Gates 0-3 (infrastructure only)
#   bash deploy_phase10.1.sh --gate 5         # Gate 5 only (ingestion)
#   bash deploy_phase10.1.sh --gate 4-6       # Gates 4-6 (data pipeline)
# ===========================================================================
set -e

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
ok() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }
info() { echo -e "${CYAN}[INFO]${NC} $1"; }

STAGING="/volume1/docker/hermes-ingestion-staging"
INGESTION_SRC="/volume3/hermes/source/ingestion"
DEPLOY_DIR="/volume3/hermes/deploy"
COLD_CSV="/volume1/hermes-cold/education/raw/chsc/secondary"
BACKUP_DIR="/volume1/hermes-cold/backups/pre_phase10_1_$(date +%Y%m%d_%H%M%S)"
CSV_URL="https://www.chsc.hk/datagovhk/ssp_2025_2026_en.csv"

# Parse gate flags
START_GATE=0
END_GATE=7

while [[ $# -gt 0 ]]; do
    case "$1" in
        --until)
            END_GATE="$2"
            START_GATE=0
            shift 2
            ;;
        --gate)
            if [[ "$2" == *"-"* ]]; then
                START_GATE="${2%-*}"
                END_GATE="${2#*-}"
            else
                START_GATE="$2"
                END_GATE="$2"
            fi
            shift 2
            ;;
        *)
            shift
            ;;
    esac
done

echo ""
echo "============================================"
echo " Hermes OS Phase 10.1 — Deployment"
echo " Gates: $START_GATE → $END_GATE"
echo "============================================"
echo ""

# =========================================================================
# Gate 0 — Pre-flight Check + Backup
# =========================================================================
run_gate0() {
echo "=== Gate 0: Pre-flight Check + Backup ==="
echo ""

docker ps > /dev/null 2>&1 || err "Docker not accessible"
ok "Docker running"

for c in hermes-postgres hermes-qdrant hermes-memory hermes-core hermes-agent hermes-knowledge; do
    docker ps --format '{{.Names}}' | grep -q "^${c}$" && ok "Container: $c" || warn "Container not found: $c"
done

if [ ! -d "$STAGING" ]; then
    STAGING=$(find /volume1/docker -maxdepth 2 -name "hermes-ingestion-staging" -type d 2>/dev/null | head -1)
    if [ -z "$STAGING" ]; then
        err "Staging directory not found. Copy from Windows Y:\\hermes-ingestion-staging\\ to NAS first."
    fi
    warn "Staging at alternate path: $STAGING"
fi
ok "Staging: $STAGING"

echo ""
echo "Creating database backup..."
mkdir -p "$BACKUP_DIR"
docker exec hermes-postgres pg_dump -U hermes -d hermes > "$BACKUP_DIR/hermes.sql" 2>&1
BACKUP_SIZE=$(ls -lh "$BACKUP_DIR/hermes.sql" | awk '{print $5}')
ok "Backup: $BACKUP_DIR/hermes.sql ($BACKUP_SIZE)"
ok "Gate 0 complete"
}

# =========================================================================
# Gate 1 — Deploy Source Files
# =========================================================================
run_gate1() {
echo "=== Gate 1: Deploy Ingestion Source Files ==="
echo ""

mkdir -p "$INGESTION_SRC/tests"

cp "$STAGING"/*.py "$INGESTION_SRC/" 2>/dev/null || true
cp "$STAGING"/*.txt "$INGESTION_SRC/" 2>/dev/null || true
cp "$STAGING"/Dockerfile "$INGESTION_SRC/" 2>/dev/null || true
cp "$STAGING"/migration_v10.sql "$INGESTION_SRC/" 2>/dev/null || true
cp "$STAGING"/tests/*.py "$INGESTION_SRC/tests/" 2>/dev/null || true

REQUIRED_FILES="Dockerfile requirements.txt migration_v10.sql downloader.py normalizer.py entity_resolver.py qdrant_sync.py pg_writer.py config.py models.py main.py"
for f in $REQUIRED_FILES; do
    [ -f "$INGESTION_SRC/$f" ] && ok "$f" || err "Missing: $f"
done
ok "Gate 1 complete"
}

# =========================================================================
# Gate 2 — Database Migration
# =========================================================================
run_gate2() {
echo "=== Gate 2: Database Migration ==="
echo ""

docker exec -i hermes-postgres psql -U hermes -d hermes < "$INGESTION_SRC/migration_v10.sql" 2>&1 | tail -5

echo ""
EXPECTED_TABLES="raw_school_source school_entity school_attributes school_identity_map school_alias recommendation_session recommendation_result recommendation_feedback"
FOUND=$(docker exec hermes-postgres psql -U hermes -d hermes -t -c "
  SELECT string_agg(table_name, ' ' ORDER BY table_name)
  FROM information_schema.tables WHERE table_schema='memory'
  AND table_name IN ('raw_school_source','school_entity','school_attributes','school_identity_map','school_alias','recommendation_session','recommendation_result','recommendation_feedback');
" 2>&1)

for t in $EXPECTED_TABLES; do
    echo "$FOUND" | grep -q "$t" && ok "Table: memory.$t" || err "Missing: memory.$t"
done
ok "Gate 2 complete"
}

# =========================================================================
# Gate 3 — Docker Service + Build
# =========================================================================
run_gate3() {
echo "=== Gate 3: Docker Service + Build ==="
echo ""

COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"

if grep -q "hermes-ingestion:" "$COMPOSE_FILE" 2>/dev/null; then
    warn "hermes-ingestion already in docker-compose.yml — skipping merge"
else
    echo "Adding hermes-ingestion to docker-compose.yml..."
    cp "$COMPOSE_FILE" "$COMPOSE_FILE.bak.$(date +%Y%m%d)"

    cat > /tmp/hermes-ingestion-block.yml << 'BLOCKEOF'
  # Hermes Ingestion — School Data Pipeline (Phase 10.1)
  hermes-ingestion:
    build:
      context: /volume3/hermes/source/ingestion
      dockerfile: Dockerfile
    image: hermes-ingestion:latest
    container_name: hermes-ingestion
    restart: unless-stopped
    volumes:
      - /volume3/hermes/source/ingestion:/app
      - /volume1/hermes-cold/education/raw:/data/ingestion:ro
    environment:
      POSTGRES_HOST: hermes-postgres
      POSTGRES_PORT: "5432"
      POSTGRES_DB: hermes
      POSTGRES_USER: hermes
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      QDRANT_HOST: hermes-qdrant
      QDRANT_PORT: "6333"
      CSV_MOUNT_PATH: /data/ingestion
    ports:
      - "8011:8000"
    networks:
      - hermes-net
    depends_on:
      postgres:
        condition: service_healthy
      qdrant:
        condition: service_started
BLOCKEOF

    # Insert block before "networks:" line using awk (available everywhere, no python needed)
    awk '
      /^networks:/ && !done {
        while ((getline line < "/tmp/hermes-ingestion-block.yml") > 0) print line
        close("/tmp/hermes-ingestion-block.yml")
        done = 1
      }
      { print }
    ' "$COMPOSE_FILE" > /tmp/docker-compose-merged.yml

    mv /tmp/docker-compose-merged.yml "$COMPOSE_FILE"
    rm -f /tmp/hermes-ingestion-block.yml
    ok "Service block added"
fi

echo ""
echo "Building hermes-ingestion..."
cd "$DEPLOY_DIR"
docker compose build --no-cache hermes-ingestion 2>&1 | tail -5
ok "Build complete"

echo ""
echo "Starting hermes-ingestion..."
docker compose up -d hermes-ingestion 2>&1
sleep 5

docker ps --format '{{.Names}}' | grep -q "hermes-ingestion" && ok "Container running: hermes-ingestion" || err "Container failed — check: docker logs hermes-ingestion"

# Health check
echo ""
HEALTH=$(curl -s http://localhost:8011/health 2>&1)
echo "$HEALTH" | grep -q '"status":"ok"' && ok "API healthy" || warn "Health: $HEALTH"
ok "Gate 3 complete"
}

# =========================================================================
# Gate 4 — Download CHSC CSV
# =========================================================================
run_gate4() {
echo "=== Gate 4: Download CHSC CSV ==="
echo ""

mkdir -p "$COLD_CSV"
CSV_FILE="$COLD_CSV/ssp_2025_2026_en.csv"

if [ -f "$CSV_FILE" ]; then
    CSV_SIZE=$(ls -lh "$CSV_FILE" | awk '{print $5}')
    LINE_COUNT=$(wc -l < "$CSV_FILE")
    ok "CSV exists: $CSV_SIZE, $LINE_COUNT rows"
else
    echo "Downloading from CHSC..."
    curl -L -o "$CSV_FILE" "$CSV_URL" 2>&1
    CSV_SIZE=$(ls -lh "$CSV_FILE" | awk '{print $5}')
    LINE_COUNT=$(wc -l < "$CSV_FILE")
    ok "Downloaded: $CSV_SIZE, $LINE_COUNT rows"
fi
ok "Gate 4 complete"
}

# =========================================================================
# Gate 5 — First Ingestion
# =========================================================================
run_gate5() {
echo "=== Gate 5: First Ingestion ==="
echo ""

# Health check
HEALTH=$(curl -s http://localhost:8011/health 2>&1)
echo "$HEALTH" | grep -q '"status":"ok"' && ok "Service healthy" || warn "Health: $HEALTH"

# Check existing
STATUS=$(curl -s http://localhost:8011/ingestion/status 2>&1)
EXISTING=$(echo "$STATUS" | grep -o '"raw_records":[0-9]*' | grep -o '[0-9]*' || echo "0")

if [ "$EXISTING" -gt 0 ]; then
    warn "Already $EXISTING raw records — use preview to verify, or re-run manually"
    echo "  To re-ingest: curl -X POST \"http://localhost:8011/ingestion/run?source_version=2025_2026_en\""
else
    # Step 1: Preview first
    echo ""
    info "Step 1: Dry-run preview..."
    PREVIEW=$(curl -s -X POST "http://localhost:8011/ingestion/preview?source_version=2025_2026_en" 2>&1)
    echo "$PREVIEW" | python3 -m json.tool 2>/dev/null || echo "$PREVIEW"
    echo ""

    # Check preview sanity
    CSV_ROWS=$(echo "$PREVIEW" | grep -o '"csv_rows":[0-9]*' | grep -o '[0-9]*' || echo "0")
    UNIQUE=$(echo "$PREVIEW" | grep -o '"estimated_unique_schools":[0-9]*' | grep -o '[0-9]*' || echo "0")

    if [ "$CSV_ROWS" -eq 0 ]; then
        err "Preview returned 0 CSV rows — check CSV file"
    fi

    RATIO=$(echo "scale=2; $UNIQUE / $CSV_ROWS" | bc 2>/dev/null || echo "0")
    info "CSV rows: $CSV_ROWS  Estimated unique: $UNIQUE  Ratio: $RATIO"

    if [ "$UNIQUE" -gt "$CSV_ROWS" ]; then
        warn "More unique schools than CSV rows — possible entity resolution issue"
        warn "Review preview output above before continuing"
        echo ""
        read -p "Continue with full ingestion? (y/N): " CONFIRM
        [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ] && err "Aborted by user"
    fi

    # Step 2: Full ingestion
    echo ""
    info "Step 2: Running full ingestion..."
    RESULT=$(curl -s -X POST "http://localhost:8011/ingestion/run?source_version=2025_2026_en" 2>&1)
    echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
fi

echo ""
info "Final status:"
curl -s http://localhost:8011/ingestion/status | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8011/ingestion/status
ok "Gate 5 complete"
}

# =========================================================================
# Gate 6 — Validate Education Engine
# =========================================================================
run_gate6() {
echo "=== Gate 6: Validate Education Engine ==="
echo ""

# Qdrant collections
echo "Qdrant collections:"
curl -s http://localhost:6333/collections | python3 -m json.tool 2>/dev/null

V1_POINTS=$(curl -s "http://localhost:6333/collections/knowledge_education_v1" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo "0")
V2_POINTS=$(curl -s "http://localhost:6333/collections/knowledge_education_v2" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo ""
[ "$V1_POINTS" -eq 8 ] && ok "v1: $V1_POINTS points (demo data — untouched)" || warn "v1: $V1_POINTS points (expected 8)"
[ "$V2_POINTS" -gt 400 ] && ok "v2: $V2_POINTS points (CHSC production)" || warn "v2: $V2_POINTS points (expected 400+)"

# DB stats
echo ""
echo "Database stats:"
docker exec hermes-postgres psql -U hermes -d hermes -t -c "
  SELECT 'school_entities: ' || COUNT(*) FROM memory.school_entity
  UNION ALL
  SELECT 'attributes: ' || COUNT(*) FROM memory.school_attributes
  UNION ALL
  SELECT 'identity_map: ' || COUNT(*) FROM memory.school_identity_map
  UNION ALL
  SELECT 'aliases: ' || COUNT(*) FROM memory.school_alias;
" 2>&1

# Test Education Engine
echo ""
info "Testing Education Engine..."
TEST_RESULT=$(curl -s -X POST http://localhost:8642/core/process \
  -H 'Content-Type: application/json' \
  -d '{"message":"幫我分析九龍城英文中學","session_id":"phase10-validation-1","session_domain":"education"}' 2>&1)

echo "$TEST_RESULT" | grep -q '"domain":"education"' && ok "Education Engine responds education domain" || warn "Response: $(echo $TEST_RESULT | head -c 200)"
ok "Gate 6 complete"
}

# =========================================================================
# Gate 7 — Evidence Integrity Check
# =========================================================================
run_gate7() {
echo "=== Gate 7: Evidence Integrity Check ==="
echo ""

# 1. Cross-verify PostgreSQL count vs Qdrant count
DB_COUNT=$(docker exec hermes-postgres psql -U hermes -d hermes -t -c "SELECT COUNT(*) FROM memory.school_entity;" 2>&1 | tr -d '[:space:]')
V2_COUNT=$(curl -s "http://localhost:6333/collections/knowledge_education_v2" | grep -o '"points_count":[0-9]*' | grep -o '[0-9]*' || echo "0")

echo "PostgreSQL school_entity: $DB_COUNT"
echo "Qdrant v2 points:         $V2_COUNT"

if [ "$DB_COUNT" -eq "$V2_COUNT" ]; then
    ok "Counts match: $DB_COUNT = $V2_COUNT"
elif [ "$DB_COUNT" -gt 0 ] && [ "$V2_COUNT" -gt 0 ]; then
    DIFF=$((DB_COUNT - V2_COUNT))
    DIFF_ABS=${DIFF#-}
    if [ "$DIFF_ABS" -le 5 ]; then
        warn "Minor mismatch: DB=$DB_COUNT Qdrant=$V2_COUNT (diff=$DIFF_ABS)"
    else
        err "Major mismatch: DB=$DB_COUNT Qdrant=$V2_COUNT"
    fi
else
    err "One side has zero records"
fi

# 2. Spot-check: 3 random schools
echo ""
info "Spot-check: 3 random schools..."

SAMPLE=$(docker exec hermes-postgres psql -U hermes -d hermes -t -c "
  SELECT school_id || '|' || canonical_name || '|' || COALESCE(district,'')
  FROM memory.school_entity ORDER BY RANDOM() LIMIT 3;
" 2>&1)

while IFS='|' read -r sid name district; do
    [ -z "$sid" ] && continue
    sid=$(echo "$sid" | tr -d '[:space:]')
    name=$(echo "$name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    district=$(echo "$district" | tr -d '[:space:]')
    point_id=$(echo "$sid" | sed 's/SCH-0*//')

    echo ""
    echo "  School: $name ($sid, $district)"

    QD=$(curl -s "http://localhost:6333/collections/knowledge_education_v2/points/$point_id" 2>&1)

    if echo "$QD" | grep -q '"id"'; then
        QD_NAME=$(echo "$QD" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        QD_SRC=$(echo "$QD" | grep -o '"source":"[^"]*"' | head -1 | cut -d'"' -f4)
        [ "$QD_SRC" = "CHSC" ] && ok "  Source: $QD_SRC" || warn "  Source: $QD_SRC"
        [ -n "$QD_NAME" ] && ok "  Name: $QD_NAME" || warn "  Name missing"
    else
        warn "  NOT in Qdrant v2"
    fi

    ATTRS=$(docker exec hermes-postgres psql -U hermes -d hermes -t -c "
      SELECT COUNT(*) FROM memory.school_attributes WHERE school_id='$sid';
    " 2>&1 | tr -d '[:space:]')
    [ "$ATTRS" -gt 0 ] && ok "  Attributes: $ATTRS" || warn "  No attributes"
done <<< "$SAMPLE"

# 3. Attribute group summary
echo ""
info "Attribute groups:"
docker exec hermes-postgres psql -U hermes -d hermes -t -c "
  SELECT COALESCE(attr_group,'ungrouped') AS grp, COUNT(*) AS n
  FROM memory.school_attributes GROUP BY attr_group ORDER BY n DESC;
" 2>&1

# 4. Academic signal coverage
SIG_COUNT=$(docker exec hermes-postgres psql -U hermes -d hermes -t -c "
  SELECT COUNT(DISTINCT school_id) FROM memory.school_attributes WHERE attr_key LIKE 'academic_signal_%';
" 2>&1 | tr -d '[:space:]')
if [ "$DB_COUNT" -gt 0 ]; then
    SIG_PCT=$(( SIG_COUNT * 100 / DB_COUNT ))
else
    SIG_PCT="0"
fi
info "academic_signal coverage: $SIG_COUNT/$DB_COUNT ($SIG_PCT%)"
[ "$SIG_COUNT" -gt "$((DB_COUNT * 80 / 100))" ] && ok "Coverage >80%" || warn "Coverage <80%"

echo ""
echo "============================================"
echo " Phase 10.1 Deployment Complete"
echo "============================================"
echo ""
echo "  DB entities:    $DB_COUNT"
echo "  Qdrant v2:      $V2_COUNT"
echo "  Academic sigs:  $SIG_COUNT ($SIG_PCT%)"
echo "  Backup:         $BACKUP_DIR/"
echo ""
echo "Checks:"
echo "  [ ] Entity count ~500 (matches CSV)"
echo "  [ ] Dedup ratio <5% (Gate 5 preview)"
echo "  [ ] DB == Qdrant v2 count"
echo "  [ ] Qdrant v1 = 8 (untouched demo)"
echo "  [ ] Academic signal >80%"
echo "  [ ] Source = CHSC in Qdrant payloads"
echo ""
echo "Switch to v2 when ready:"
echo "  KNOWLEDGE_EDUCATION_VERSION=v2 docker compose restart hermes-knowledge"
ok "Gate 7 complete"
}

# =========================================================================
# Gate Runner
# =========================================================================
GATES=(run_gate0 run_gate1 run_gate2 run_gate3 run_gate4 run_gate5 run_gate6 run_gate7)

for ((i=START_GATE; i<=END_GATE; i++)); do
    if [ "$i" -ge 0 ] && [ "$i" -lt "${#GATES[@]}" ]; then
        if [ "$i" -gt "$START_GATE" ]; then echo ""; fi
        ${GATES[$i]}
    fi
done

echo ""
ok "Gates $START_GATE → $END_GATE completed successfully"
