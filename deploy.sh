#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Hermes Stack 部署腳本
# 在 NAS 上執行：bash deploy.sh
# ═══════════════════════════════════════════════════════════

set -e

STACK_DIR="/volume1/docker/hermes-stack"
AIOS_DIR="/volume1/docker/aios/compose"

echo "═══════════════════════════════════════════════════════"
echo "  Hermes 多 Agent 部署"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── 步驟 1：檢查 Docker ─────────────────────────────────
echo "[1/6] 檢查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安裝，請先安裝 Docker"
    exit 1
fi
echo "✅ Docker $(docker --version --format '{{.Server.Version}}')"

# ── 步驟 2：啟動 aios 基礎設施 ──────────────────────────
echo ""
echo "[2/6] 啟動 aios 基礎設施（Postgres + Redis + MinIO）..."
cd "$AIOS_DIR"

# 確認 aios-net 網路存在
if ! docker network inspect aios-net &>/dev/null; then
    echo "  建立 aios-net 網路..."
    docker network create aios-net
fi

# 啟動 aios 服務（不含 Qdrant，hermes 有自己的）
docker compose up -d postgres redis minio

# 等待 Redis 健康
echo "  等待 Redis 就緒..."
for i in $(seq 1 30); do
    if docker exec aios-redis redis-cli ping 2>/dev/null | grep -q PONG; then
        echo "  ✅ Redis 就緒"
        break
    fi
    sleep 1
done

# ── 步驟 3：建立 hermes-stack 資料夾 ─────────────────────
echo ""
echo "[3/6] 建立 hermes-stack 資料夾..."
mkdir -p "$STACK_DIR/profiles"
echo "✅ $STACK_DIR"

# ── 步驟 4：檢查 .env ───────────────────────────────────
echo ""
echo "[4/6] 檢查 .env..."
if [ ! -f "$STACK_DIR/.env" ]; then
    echo "⚠️  .env 不存在，請從 env.example 複製並填入 API keys"
    echo "   cp env.example $STACK_DIR/.env"
    echo "   nano $STACK_DIR/.env"
    exit 1
fi

# 檢查至少有一個 API key
source "$STACK_DIR/.env"
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ]; then
    echo "❌ 至少需要一個 API key（ANTHROPIC / OPENAI / GEMINI）"
    exit 1
fi
echo "✅ .env 已配置"

# ── 步驟 5：啟動 hermes-stack ───────────────────────────
echo ""
echo "[5/6] 啟動 hermes-stack..."
cd "$STACK_DIR"
docker compose up -d

# 等待服務健康
echo "  等待服務就緒..."
sleep 5

# 檢查 LiteLLM
for i in $(seq 1 30); do
    if curl -sf http://localhost:8643/health &>/dev/null; then
        echo "  ✅ LiteLLM Proxy 就緒"
        break
    fi
    sleep 2
done

# 檢查 Hermes Gateway
for i in $(seq 1 30); do
    if curl -sf http://localhost:8642/health &>/dev/null; then
        echo "  ✅ Hermes Gateway 就緒"
        break
    fi
    sleep 2
done

# 檢查 Qdrant
for i in $(seq 1 30); do
    if curl -sf http://localhost:6334/healthz &>/dev/null; then
        echo "  ✅ Qdrant 就緒"
        break
    fi
    sleep 2
done

# ── 步驟 6：顯示狀態 ────────────────────────────────────
echo ""
echo "[6/6] 部署完成！"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  服務訪問點"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Hermes Gateway:    http://localhost:8642"
echo "  LiteLLM Proxy:     http://localhost:8643"
echo "  Qdrant:            http://localhost:6334"
echo ""
echo "  容器狀態："
docker ps --format "  {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "hermes|litellm"
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  下一步"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  1. 建立 Agent Profile："
echo "     docker exec hermes-gateway hermes profile create education"
echo "     docker exec hermes-gateway hermes profile create ecommerce"
echo "     docker exec hermes-gateway hermes profile create personal"
echo "     docker exec hermes-gateway hermes profile create investment"
echo ""
echo "  2. 查看 Gateway 日誌："
echo "     docker logs -f hermes-gateway"
echo ""
echo "  3. 查看 LiteLLM 日誌："
echo "     docker logs -f hermes-litellm"
echo ""
