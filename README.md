# ═══════════════════════════════════════════════════════════
# Hermes Stack — 部署文件
# ═══════════════════════════════════════════════════════════

## 架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                    NAS (UGOS)                            │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Hermes Gateway (8642)                          │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │    │
│  │  │ 教育   │ │ 電商   │ │ 個人   │ │ 投資   │   │    │
│  │  │Profile │ │Profile │ │Profile │ │Profile │   │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘   │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │                                   │
│  ┌───────────────────┴─────────────────────────────┐    │
│  │  LiteLLM Proxy (8643)  ← API 路由/快取/成本控制  │    │
│  └───────────────────┬─────────────────────────────┘    │
│                      │                                   │
│         ┌────────────┼────────────┐                     │
│         ▼            ▼            ▼                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│  │ Anthropic │ │  OpenAI   │ │  Gemini   │             │
│  │ (Claude)  │ │  (GPT)    │ │  (Flash)  │             │
│  └───────────┘ └───────────┘ └───────────┘             │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐                     │
│  │ Qdrant(6334) │  │ Redis(6380)  │  ← 基礎設施        │
│  └──────────────┘  └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## 檔案清單

| 檔案 | 用途 |
|------|------|
| `docker-compose.yml` | 服務編排（Gateway + LiteLLM + Qdrant） |
| `litellm-config.yaml` | LiteLLM 模型路由、快取、回退設定 |
| `env.example` | 環境變數範本（API keys） |
| `profiles.yaml` | 4 個 Agent Profile 配置參考 |
| `deploy.sh` | 一鍵部署腳本 |

## 前置準備

### 1. 申請 LLM API Keys

至少需要一個，建議申請多個：

| 供應商 | 申請網址 | 用途 |
|--------|---------|------|
| **Anthropic** | https://console.anthropic.com/ | 教育、投資 Agent |
| **OpenAI** | https://platform.openai.com/ | 電商 Agent |
| **Google AI** | https://aistudio.google.com/ | 個人 Agent |
| **DeepSeek** | https://platform.deepseek.com/ | 備用（便宜） |

### 2. 確認 aios 基礎設施

```bash
# SSH 進 NAS
ssh morefun886@192.168.9.2

# 檢查 aios-net 網路是否存在
docker network ls | grep aios-net

# 如果不存在，建立
docker network create aios-net
```

### 3. 上傳檔案到 NAS

用 SMB 或 SCP 將檔案上傳：

```bash
# 方法一：SMB（Windows 檔案總管）
# 複製到 Y:\hermes-stack\

# 方法二：SCP
scp docker-compose.yml litellm-config.yaml env.example profiles.yaml deploy.sh \
    morefun886@192.168.9.2:/volume1/docker/hermes-stack/
```

## 部署步驟

### Step 1：配置環境變數

```bash
cd /volume1/docker/hermes-stack
cp env.example .env
nano .env   # 填入你的 API keys
```

### Step 2：執行部署

```bash
chmod +x deploy.sh
./deploy.sh
```

### Step 3：驗證服務

```bash
# 檢查容器狀態
docker ps

# 檢查 Gateway 健康
curl http://localhost:8642/health

# 檢查 LiteLLM 健康
curl http://localhost:8643/health

# 檢查 Qdrant
curl http://localhost:6334/healthz
```

### Step 4：建立 Agent Profiles

```bash
docker exec hermes-gateway hermes profile create education
docker exec hermes-gateway hermes profile create ecommerce
docker exec hermes-gateway hermes profile create personal
docker exec hermes-gateway hermes profile create investment
```

## 服務端口

| 服務 | 端口 | 說明 |
|------|------|------|
| Hermes Gateway | 8642 | Agent 管理 API |
| LiteLLM Proxy | 8643 | LLM API 統一入口 |
| Qdrant | 6334 | 向量資料庫（hermes 專用） |
| aios-Redis | 6380 | 快取（共用） |
| aios-Postgres | 5435 | 資料庫（選用） |
| aios-MinIO | 9000 | 物件儲存（選用） |

## 故障排除

### 容器無法啟動

```bash
# 查看日誌
docker logs hermes-gateway
docker logs hermes-litellm

# 常見原因：
# 1. 端口被佔用 → netstat -tlnp | grep 8642
# 2. .env 缺少 API key → 檢查 .env
# 3. aios-net 不存在 → docker network create aios-net
```

### API 呼叫失敗

```bash
# 測試 LiteLLM
curl http://localhost:8643/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"education-main","messages":[{"role":"user","content":"你好"}]}'

# 檢查代理設定
docker exec hermes-gateway env | grep -i proxy
```

### Qdrant 無法連線

```bash
# 檢查 Qdrant 日誌
docker logs hermes-qdrant

# 測試連線
curl http://localhost:6334/collections
```

## 成本估算

| Agent | 模型 | 月費估算 |
|-------|------|---------|
| 教育 | Claude Sonnet 4 | $15-25 |
| 電商 | GPT-4o-mini | $5-10 |
| 個人 | Gemini Flash 2.5 | $3-5 |
| 投資 | Claude Opus 4 | $20-40 |
| **總計** | | **$43-80/月** |

## 安全提醒

1. **API Key 保護**：`.env` 文件不要上傳到 Git 或分享
2. **Gateway 端口**：8642 不要直接暴露在公網
3. **LiteLLM Master Key**：預設值請更改
4. **SSH 密碼**：建議改用 SSH Key 認證
