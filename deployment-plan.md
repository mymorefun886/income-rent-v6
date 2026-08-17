# ═══════════════════════════════════════════════════════════
# Hermes 多 Agent 系統 — 完整部署計畫
# ═══════════════════════════════════════════════════════════

## 系統架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                    NAS (UGOS)                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Hermes Gateway (port 8642)                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐ │   │
│  │  │ 教育     │ │ 電商     │ │ 個人助理 │ │ 投資 │ │   │
│  │  │ Profile  │ │ Profile  │ │ Profile  │ │Profile│ │   │
│  │  │          │ │          │ │          │ │      │ │   │
│  │  │ WhatsApp │ │ Telegram │ │ Telegram │ │Discord│ │   │
│  │  │ Telegram │ │ Discord  │ │          │ │Telegram│ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────┘ │   │
│  └───────────────────┬──────────────────────────────┘   │
│                      │                                   │
│  ┌───────────────────┴──────────────────────────────┐   │
│  │  LiteLLM Proxy (8643)  ← API 路由/快取/成本控制  │   │
│  └───────────────────┬──────────────────────────────┘   │
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

---

## 已完成項目 ✅

| 項目 | 狀態 |
|------|------|
| LiteLLM Proxy 部署 | ✅ 運行中 (port 8643) |
| Hermes Gateway 部署 | ✅ 運行中 (port 8642) |
| Qdrant 部署 | ✅ 運行中 (port 6334) |
| aios 基礎設施 (Postgres/Redis/MinIO) | ✅ 運行中 |
| LongCat API 對接 | ✅ 已配置 |
| 11 個模型載入 | ✅ |

---

## 4 個 Agent 詳細設計

### 1. 教育 Agent（Education Profile）

| 項目 | 內容 |
|------|------|
| **用途** | 香港 K-12 升學決策助手 |
| **LLM** | Claude Sonnet 4（需要文化雙語能力 + 細緻推理） |
| **備用** | LongCat-2.0 → GPT-4o |
| **訊息頻道** | WhatsApp（家長群組）、Telegram |
| **知識庫** | 學校資料、排名、課程體系（IB/AP/A-Level）、入學數據 |
| **家庭 Profile** | 性格、興趣、學習模式、地區、預算、接送能力 |
| **進階功能** | 興趣班推薦、課外活動規劃、WhatsApp 群組分享練習 |
| **系統提示** | 見 profiles.yaml → education |

### 2. 跨境電商 Agent（E-commerce Profile）

| 項目 | 內容 |
|------|------|
| **用途** | Shopee/eBay 多平台營運助手 |
| **LLM** | GPT-4o-mini（高量 listing 生成，便宜快速） |
| **備用** | LongCat-2.0 → Claude Haiku 4.5 |
| **訊息頻道** | Telegram、Discord |
| **知識庫** | 平台政策、運費定價、產品型錄 |
| **功能** | 競品分析、Listing 生成、庫存管理、補貨提醒 |
| **系統提示** | 見 profiles.yaml → ecommerce |

### 3. 個人助理 Agent（Personal Profile）

| 項目 | 內容 |
|------|------|
| **用途** | 日常事務管理 |
| **LLM** | Gemini Flash 2.5（結構化任務、最便宜） |
| **備用** | LongCat-fast → GPT-4o-mini |
| **訊息頻道** | Telegram |
| **功能** | 日曆、提醒（水電交費、服務續期）、筆記、任務管理 |
| **系統提示** | 見 profiles.yaml → personal |

### 4. 投資 Agent（Investment Profile）

| 項目 | 內容 |
|------|------|
| **用途** | 美股期權分析、投資組合管理 |
| **LLM** | Claude Opus 4（金融分析需要最高準確度） |
| **備用** | LongCat-2.0 → GPT-4o |
| **訊息頻道** | Discord、Telegram |
| **知識庫** | 期權策略、公司資料、風險框架 |
| **功能** | 期權分析、個股研究、Portfolio 追蹤、風險管理 |
| **系統提示** | 見 profiles.yaml → investment |

---

## 部署時程計畫

### Phase 1：Agent Profile 建立（第 1 週）

#### Step 1.1：建立 4 個 Profile

```bash
# SSH 進 NAS
ssh morefun886@192.168.9.2

# 建立 Profile
docker exec hermes-gateway hermes profile create education
docker exec hermes-gateway hermes profile create ecommerce
docker exec hermes-gateway hermes profile create personal
docker exec hermes-gateway hermes profile create investment

# 確認 Profile 已建立
docker exec hermes-gateway hermes profile list
```

#### Step 1.2：配置各 Profile 系統提示

每個 Profile 需要設定對應的 system_prompt（參考 profiles.yaml）。

#### Step 1.3：測試各 Agent 回應

```bash
# 測試教育 Agent
docker exec hermes-gateway hermes chat --profile education "你好，我想了解香港直資學校"

# 測試電商 Agent
docker exec hermes-gateway hermes chat --profile ecommerce "請幫我分析 Shopee 台灣站的運費規則"

# 測試個人助理
docker exec hermes-gateway hermes chat --profile personal "請提醒我明天繳電費"

# 測試投資 Agent
docker exec hermes-gateway hermes chat --profile investment "請分析 AAPL 的期權策略"
```

---

### Phase 2：訊息平台整合（第 2 週）

#### Step 2.1：Telegram Bot 設定

1. 在 Telegram 找 @BotFather，建立 4 個 Bot（每個 Agent 一個）
2. 取得各 Bot 的 Token
3. 在 Gateway 配置中加入：

```yaml
# 在 Gateway 環境變數或配置檔中
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ALLOWED_USERS=your_telegram_id
```

#### Step 2.2：WhatsApp 整合（教育 Agent）

1. 用舊手機或專用手機保持 Wi-Fi 連線
2. 掃描 QR code 綁定 WhatsApp Web
3. 配置：

```yaml
WHATSAPP_ENABLED=true
WHATSAPP_ALLOWED_NUMBERS=+852xxxxxxxx
```

#### Step 2.3：Discord Bot 設定（電商、投資 Agent）

1. 在 Discord Developer Portal 建立 Application
2. 取得 Bot Token
3. 邀請 Bot 到你的伺服器
4. 配置：

```yaml
DISCORD_BOT_TOKEN=your_discord_token
DISCORD_ALLOWED_GUILD_IDS=your_guild_id
```

---

### Phase 3：知識庫建置（第 3-4 週）

#### Step 3.1：Qdrant Collection 建立

```bash
# 建立教育知識庫
curl -X PUT http://localhost:6334/collections/education \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'

# 建立電商知識庫
curl -X PUT http://localhost:6334/collections/ecommerce \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'

# 建立個人助理知識庫
curl -X PUT http://localhost:6334/collections/personal \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'

# 建立投資知識庫
curl -X PUT http://localhost:6334/collections/investment \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'
```

#### Step 3.2：教育知識庫資料

**資料來源：**
- 香港教育局學校資料
- 學校開放日資料
- IB/AP/A-Level 課程資訊
- 歷年收生成績
- 興趣班、課外活動資料

**匯入方式：**
```python
# 使用 OpenAI text-embedding-3-small 生成向量
# 儲存到 Qdrant education collection
```

#### Step 3.3：電商知識庫資料

**資料來源：**
- Shopee 賣家中心政策
- eBay 賣家規則
- 各平台手續費、物流費率
- 產品型錄、競品資料

**現有資料位置：**
- `Z:\Backup\workspace\ecommerce\listings\`
- `Z:\Backup\workspace\ecommerce\orders\`

#### Step 3.4：投資知識庫資料

**資料來源：**
- 期權策略指南（Covered Call、Protective Put、Iron Condor）
- 公司基本資料
- 風險管理框架

---

### Phase 4：定時任務與自動化（第 5 週）

#### Step 4.1：Cron 任務設定

```bash
# 每日市場摘要（投資 Agent）
docker exec hermes-gateway hermes cron add \
  --profile investment \
  --schedule "0 9 * * 1-5" \
  --task "提供今日美股市場摘要和熱門期權資訊"

# 每週庫存檢查（電商 Agent）
docker exec hermes-gateway hermes cron add \
  --profile ecommerce \
  --schedule "0 10 * * 1" \
  --task "檢查庫存狀態，提醒需要補貨的產品"

# 帳單提醒（個人助理）
docker exec hermes-gateway hermes cron add \
  --profile personal \
  --schedule "0 9 1 * *" \
  --task "提醒本月需要繳納的帳單和服務續期事項"
```

#### Step 4.2：提醒類型

| 提醒類型 | Agent | 頻率 |
|---------|-------|------|
| 水電瓦斯繳費 | 個人助理 | 每月 |
| 保險續期 | 個人助理 | 每年 |
| 服務訂閱續期 | 個人助理 | 每月/每年 |
| 庫存補貨 | 電商 | 每週 |
| 市場開盤提醒 | 投資 | 每日 |
| 學校報名截止日期 | 教育 | 每季 |

---

### Phase 5：監控與優化（第 6 週+）

#### Step 5.1：成本監控

| Agent | 主要模型 | 備用模型 | 月費估算 |
|-------|---------|---------|---------|
| 教育 | Claude Sonnet 4 | GPT-4o | $15-25 |
| 電商 | GPT-4o-mini | Claude Haiku 4.5 | $5-10 |
| 個人 | Gemini Flash 2.5 | GPT-4o-mini | $3-5 |
| 投資 | Claude Opus 4 | GPT-4o | $20-40 |
| **總計** | | | **$43-80/月** |

#### Step 5.2：效能監控

```bash
# 查看容器資源使用
docker stats hermes-gateway hermes-litellm hermes-qdrant

# 查看 LiteLLM 快取命中率
curl http://localhost:8643/health -H "Authorization: Bearer <REDACTED>"

# 查看 Gateway 日誌
docker logs -f hermes-gateway
```

#### Step 5.3：備份策略

```bash
# 每日備份 Agent 資料到 Z: 驅動
# /opt/data → Z:\Backup\hermes-agent\

# Qdrant 資料備份
# /var/lib/docker/volumes/hermes-stack_hermes-qdrant-data → Z:\Backup\qdrant\
```

---

## 服務端口總覽

| 服務 | 端口 | 說明 |
|------|------|------|
| Hermes Gateway | 8642 | Agent 管理 API |
| LiteLLM Proxy | 8643 | LLM API 統一入口 |
| Qdrant | 6334 | 向量資料庫（hermes 專用） |
| aios-Redis | 6380 | 快取（共用） |
| aios-Postgres | 5435 | 資料庫（選用） |
| aios-MinIO | 9000 | 物件儲存（選用） |

---

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
  -H "Authorization: Bearer <REDACTED>" \
  -d '{"model":"longcat","messages":[{"role":"user","content":"你好"}]}'

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

---

## 安全提醒

1. **API Key 保護**：`.env` 文件不要上傳到 Git 或分享
2. **Gateway 端口**：8642 不要直接暴露在公網
3. **LiteLLM Master Key**：預設值請更改
4. **SSH 密碼**：建議改用 SSH Key 認證
5. **備份**：定期備份 `/opt/data` 和 Qdrant 資料

---

## 下一步行動

| 優先級 | 行動 | 負責人 |
|--------|------|--------|
| 🔴 高 | 建立 4 個 Agent Profile | 你 |
| 🔴 高 | 測試各 Agent 回應 | 你 |
| 🟡 中 | 設定 Telegram Bot | 你 |
| 🟡 中 | 匯入教育知識庫 | 你 |
| 🟢 低 | 設定 Discord Bot | 你 |
| 🟢 低 | 設定 WhatsApp | 你 |
| 🟢 低 | 配置定時任務 | 你 |

---

*文件建立：2026-08-16*
*位置：Z:\Backup\workspace\hermes-agent\deployment-plan.md*
