# ═══════════════════════════════════════════════════════════
# Hermes Agent + NAS Docker 系統架構總結
# ═══════════════════════════════════════════════════════════

## 一、系統架構總覽

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ugreen DXP4800 Plus NAS (UGOS)                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Docker Network: aios-net                     │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │         Hermes Gateway (port 8642)                │   │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │   │    │
│  │  │  │ 教育     │ │ 電商     │ │ 個人助理 │ │ 投資 │ │   │    │
│  │  │  │ Profile  │ │ Profile  │ │ Profile  │ │Profile│ │   │    │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────┘ │   │    │
│  │  └───────────────────┬──────────────────────────────┘   │    │
│  │                      │                                   │    │
│  │  ┌───────────────────┴──────────────────────────────┐   │    │
│  │  │  LiteLLM Proxy (8643)  ← API 路由/快取/成本控制  │   │    │
│  │  └───────────────────┬──────────────────────────────┘   │    │
│  │                      │                                   │    │
│  │         ┌────────────┼────────────┐                     │    │
│  │         ▼            ▼            ▼                     │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐             │    │
│  │  │ Anthropic │ │  OpenAI   │ │  Gemini   │             │    │
│  │  │ (Claude)  │ │  (GPT)    │ │  (Flash)  │             │    │
│  │  └───────────┘ └───────────┘ └───────────┘             │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐                     │    │
│  │  │ Qdrant(6334) │  │ Redis(6380)  │  ← 基礎設施        │    │
│  │  └──────────────┘  └──────────────┘                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Docker Network: income-net-v6                │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │    │
│  │  │ income-api  │ │ income-web  │ │ income-cloudflared│  │    │
│  │  │ (8788)      │ │ (8081)      │ │ (Tunnel)        │   │    │
│  │  └─────────────┘ └─────────────┘ └─────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、Docker 容器清單

### A. Hermes Stack（aios-net）

| 容器名稱 | 映像檔 | 端口 | 狀態 | 說明 |
|---------|--------|------|------|------|
| hermes-gateway | nousresearch/hermes-agent:latest | 8642 | ✅ Up 37h | Agent 管理 Gateway |
| hermes-litellm | ghcr.io/berriai/litellm:main-latest | 8643 | ✅ Up 37h | LLM API 代理 |
| hermes-qdrant | qdrant/qdrant:latest | 6334 | ✅ Up 37h | 向量資料庫 |

### B. aios 基礎設施（aios-net）

| 容器名稱 | 映像檔 | 端口 | 狀態 | 說明 |
|---------|--------|------|------|------|
| aios-postgres | postgres:16 | 5435 | ✅ healthy | 資料庫 |
| aios-redis | redis:7-alpine | 6380 | ✅ healthy | 快取 |
| aios-minio | minio/minio:latest | 9000-9001 | ✅ healthy | 物件儲存 |

### C. Income 出租系統（income-net-v6）

| 容器名稱 | 映像檔 | 端口 | 狀態 | 說明 |
|---------|--------|------|------|------|
| income-api-v6 | income-rent-v6-api | 8788 | ⚠️ unhealthy | 出租 API |
| income-web-v6 | income-rent-v6-web | 8081 | ✅ Up 13h | 出租前端 |
| income-cloudflared | cloudflare/cloudflared | - | ✅ Up 12h | Cloudflare Tunnel |

---

## 三、網路架構

| 網路名稱 | 驅動 | 用途 |
|---------|------|------|
| aios-net | bridge | Hermes + 基礎設施共用 |
| income-net-v6 | bridge | 出租系統獨立網路 |
| bridge | bridge | 預設 Docker 網路 |
| host | host | 主機網路 |
| none | none | 無網路 |

---

## 四、Hermes Agent 功能詳述

### 4.1 Hermes Gateway（port 8642）

**核心功能：**
- 多 Profile 管理（每個 Profile = 獨立 Agent）
- 訊息平台整合（Telegram、WhatsApp、Discord）
- 定時任務排程（Cron）
- API Server（RESTful API）
- Web Dashboard（Web UI）

**目前配置：**
```
API_SERVER_ENABLED=true
API_SERVER_HOST=0.0.0.0
API_SERVER_PORT=8642
HERMES_LLM_ENDPOINT=http://litellm-proxy:4000/v1
HERMES_LLM_API_KEY=sk-hermes-master
HERMES_LLM_MODEL=education-main
```

**現有 Profile：**
| Profile | 模型 | 狀態 |
|---------|------|------|
| default | LongCat-2.0 | ✅ running |

### 4.2 LiteLLM Proxy（port 8643）

**核心功能：**
- LLM API 統一入口
- 模型路由與負載平衡
- 自動降級（Fallback）
- Redis 快取（語意快取）
- 成本控制（月預算 $100）
- API Key 管理

**已配置模型（11 個）：**

| 模型名稱 | 實際模型 | 用途 |
|---------|---------|------|
| education-main | Claude Sonnet 4 | 教育 Agent 主要 |
| education-fallback | GPT-4o | 教育 Agent 備用 |
| ecommerce-main | GPT-4o-mini | 電商 Agent 主要 |
| ecommerce-fallback | Claude Haiku 4.5 | 電商 Agent 備用 |
| personal-main | Gemini Flash 2.5 | 個人助理主要 |
| personal-fallback | GPT-4o-mini | 個人助理備用 |
| investment-main | Claude Opus 4 | 投資 Agent 主要 |
| investment-fallback | GPT-4o | 投資 Agent 備用 |
| longcat | LongCat-2.0 | 通用備用 |
| longcat-fast | LongCat-2.0 | 快速回應 |
| default | LongCat-2.0 | 預設模型 |

**降級策略：**
```
education-main → longcat → education-fallback
ecommerce-main → longcat → ecommerce-fallback
personal-main → longcat-fast → personal-fallback
investment-main → longcat → investment-fallback
```

### 4.3 Qdrant（port 6334）

**核心功能：**
- 向量資料庫（RAG 知識庫）
- 支援多個 Collection
- 語意搜尋
- Metadata 過濾

**目前 Collection：** 尚未建立（需建立 education、ecommerce、personal、investment）

---

## 五、API Keys 配置

| 服務 | Key 狀態 | 說明 |
|------|---------|------|
| LongCat | ✅ 已配置 | ak_2Nc8gr87l6nV7Qs7588gE8kO3jR3U |
| Anthropic | ⚠️ placeholder | 需替換為真實 key |
| OpenAI | ⚠️ placeholder | 需替換為真實 key |
| Gemini | ⚠️ placeholder | 需替換為真實 key |
| DeepSeek | ⚠️ placeholder | 需替換為真實 key |

---

## 六、服務端口總覽

| 服務 | 端口 | 網路 | 說明 |
|------|------|------|------|
| Hermes Gateway | 8642 | aios-net | Agent API + Dashboard |
| LiteLLM Proxy | 8643 | aios-net | LLM API 統一入口 |
| Qdrant | 6334 | aios-net | 向量資料庫 |
| aios-Postgres | 5435 | aios-net | 資料庫 |
| aios-Redis | 6380 | aios-net | 快取 |
| aios-MinIO | 9000-9001 | aios-net | 物件儲存 |
| income-api-v6 | 8788 | income-net-v6 | 出租 API |
| income-web-v6 | 8081 | income-net-v6 | 出租前端 |

---

## 七、後續需優化完善項目

### 🔴 高優先級

| 項目 | 說明 | 預計時間 |
|------|------|---------|
| **建立 4 個 Agent Profile** | education、ecommerce、personal、investment | 30 分鐘 |
| **配置真實 API Keys** | Anthropic、OpenAI、Gemini 至少各一個 | 1 小時 |
| **測試各 Agent 回應** | 確保 4 個 Agent 都能正常對話 | 1 小時 |

### 🟡 中優先級

| 項目 | 說明 | 預計時間 |
|------|------|---------|
| **Telegram Bot 整合** | 建立 Bot、配置 Token | 2 小時 |
| **Qdrant Collection 建立** | 建立 4 個知識庫 Collection | 1 小時 |
| **知識庫資料匯入** | 學校資料、電商產品、投資資訊 | 4-8 小時 |
| **系統提示優化** | 調整各 Agent 的 system_prompt | 2 小時 |

### 🟢 低優先級

| 項目 | 說明 | 預計時間 |
|------|------|---------|
| **WhatsApp 整合** | 教育 Agent 家長群組 | 2 小時 |
| **Discord 整合** | 電商、投資 Agent | 2 小時 |
| **定時任務設定** | Cron 排程（市場摘要、庫存提醒等） | 1 小時 |
| **監控與告警** | 成本監控、健康檢查 | 2 小時 |
| **備份策略** | 定期備份 Agent 資料和 Qdrant | 1 小時 |

---

## 八、快速指令參考

### 容器管理
```bash
# 查看所有容器
docker ps

# 查看 Hermes 日誌
docker logs -f hermes-gateway
docker logs -f hermes-litellm

# 重啟服務
docker restart hermes-gateway
docker restart hermes-litellm
```

### Profile 管理
```bash
# 建立 Profile
docker exec hermes-gateway hermes profile create education
docker exec hermes-gateway hermes profile create ecommerce
docker exec hermes-gateway hermes profile create personal
docker exec hermes-gateway hermes profile create investment

# 列出所有 Profile
docker exec hermes-gateway hermes profile list

# 測試對話
docker exec hermes-gateway hermes chat --profile education "你好"
```

### LiteLLM 測試
```bash
# 測試 API
curl http://localhost:8643/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <REDACTED>" \
  -d '{"model":"longcat","messages":[{"role":"user","content":"你好"}]}'
```

### Qdrant 管理
```bash
# 建立 Collection
curl -X PUT http://localhost:6334/collections/education \
  -H "Content-Type: application/json" \
  -d '{"vectors":{"size":1536,"distance":"Cosine"}}'

# 列出所有 Collection
curl http://localhost:6334/collections
```

---

## 九、成本估算

| Agent | 主要模型 | 備用模型 | 月費估算 |
|-------|---------|---------|---------|
| 教育 | Claude Sonnet 4 | GPT-4o | $15-25 |
| 電商 | GPT-4o-mini | Claude Haiku 4.5 | $5-10 |
| 個人 | Gemini Flash 2.5 | GPT-4o-mini | $3-5 |
| 投資 | Claude Opus 4 | GPT-4o | $20-40 |
| **總計** | | | **$43-80/月** |

**LiteLLM 成本控制：**
- 月預算上限：$100
- Redis 快取：相似問題命中快取，節省 API 呼叫
- 降級策略：主要模型失敗時自動切換到較便宜的備用模型

---

## 十、安全提醒

1. **API Key 保護**：`.env` 文件不要上傳到 Git 或分享
2. **Gateway 端口**：8642 不要直接暴露在公網
3. **LiteLLM Master Key**：目前為 `sk-hermes-master`，建議更改
4. **SSH 密碼**：目前使用密碼登入，建議改用 SSH Key
5. **備份**：定期備份 `/opt/data` 和 Qdrant 資料

---

*文件建立：2026-08-16*
*位置：D:\Cowork\Claude Code\hermes-architecture-summary.md*
