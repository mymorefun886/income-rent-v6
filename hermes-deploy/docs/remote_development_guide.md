# 家中遠端開發對接指南

**日期**: 2026-07-27
**目標**: 在家中繼續 Education Engine 開發

---

## 1. 連接準備

### 1.1 確認 Tailscale 已連接

在香港 PC 上：
```bash
# 檢查 Tailscale 狀態
tailscale status

# 如果未連接
tailscale up
```

確認能看到 NAS：`100.86.88.88`

### 1.2 測試連通性

```bash
# 測試 NAS 連通
ping 100.86.88.88

# 測試 code-server
curl http://100.86.88.88:8080/healthz
```

---

## 2. 遠端開發環境

### 2.1 code-server（推薦）

**訪問方式**：
```
瀏覽器打開：http://100.86.88.88:8080
```

**登入**：
- 密碼：在 NAS 上設定的密碼

**工作目錄**：
```
/home/coder/hermes
```

**已安裝的 Extension**：
- Python
- Docker
- GitLens
- YAML
- Ruff

### 2.2 VS Code Remote（可選）

如果你使用 VS Code：
1. 安裝 Remote - SSH Extension
2. 連接：`ssh root@100.86.88.88`

---

## 3. 資料庫訪問

### 3.1 PostgreSQL

**連接資訊**：
```
Host: 100.86.88.88
Port: 5435
Database: hermes
User: hermes
Password: （NAS 上設定的密碼）
```

**使用 pgAdmin**：
1. 在香港 PC 安裝 pgAdmin
2. 新增伺服器，填入上述資訊

**使用 psql**：
```bash
psql -h 100.86.88.88 -p 5435 -U hermes -d hermes
```

**使用 code-server 終端**：
```bash
# 在 code-server 中
psql -h localhost -p 5435 -U hermes -d hermes
```

### 3.2 Qdrant

**訪問方式**：
```
http://100.86.88.88:6333/dashboard
```

---

## 4. Hermes API 訪問

### 4.1 Gateway

```
http://100.86.88.88:8642
```

### 4.2 測試 API

```bash
# 健康檢查
curl http://100.86.88.88:8642/health

# 測試 Education Engine
curl -X POST http://100.86.88.88:8642/gateway/message \
  -H 'Content-Type: application/json' \
  -d '{"message":"九龍城中學推薦","user_id":"test","source":"validation"}'
```

---

## 5. 下一步工作

### 5.1 Admission Network 資料匯入（優先）

**步驟**：
1. 下載 EDB 學校網資料
2. 使用資料模板整理
3. 匯入資料庫

**資料模板位置**：
```
hermes-deploy/docs/school_network_data_template.md
```

**匯入命令**：
```sql
-- 在 code-server 終端或 psql 中
COPY memory.school_network(primary_school_id, secondary_net, district, allocation_year, source, confidence)
FROM '/path/to/school_network.csv' DELIMITER ',' CSV HEADER;

COPY memory.secondary_network_school(secondary_net, secondary_school_id, allocation_year, priority, source, confidence)
FROM '/path/to/secondary_network_school.csv' DELIMITER ',' CSV HEADER;
```

### 5.2 Layer 3 Through-train Graph

**步驟**：
1. 抓取「一條龍」學校名單
2. 建立 `school_relationship` 表格
3. 匯入資料

### 5.3 Shared Memory Layer

**步驟**：
1. 建立 Memory 表格
2. 建立 Memory API
3. 整合 Skill-Memory

---

## 6. 安全注意事項

### 6.1 不要做的事

- ❌ 不要重啟 Docker 容器（會影響 Hermes Runtime）
- ❌ 不要直接修改 `/volume2` 或 `/volume3` 上的檔案
- ❌ 不要暴露 NAS 埠口到外網
- ❌ 不要在 code-server 中使用 root 權限

### 6.2 應該做的事

- ✅ 使用 code-server 進行開發
- ✅ 使用 Tailscale 連接
- ✅ 使用 pgAdmin 或 psql 訪問資料庫
- ✅ 定期備份資料

---

## 7. 常用指令

### 7.1 查看 Docker 狀態

```bash
# SSH 到 NAS（如果需要）
ssh root@100.86.88.88

# 查看容器狀態
docker ps

# 查看日誌
docker logs hermes-gateway
docker logs hermes-core
```

### 7.2 資料庫備份

```bash
# 備份 PostgreSQL
docker exec hermes-postgres pg_dump -U hermes hermes > backup_$(date +%Y%m%d).sql
```

### 7.3 資料匯入

```bash
# 匯入 CSV 到 PostgreSQL
cat school_network.csv | docker exec -i hermes-postgres psql -U hermes -d hermes -c "\COPY memory.school_network FROM STDIN WITH CSV HEADER"
```

---

## 8. 連線問題排查

### 8.1 無法連接 Tailscale

```bash
# 檢查 Tailscale 狀態
tailscale status

# 重新連接
tailscale down
tailscale up
```

### 8.2 無法訪問 code-server

```bash
# 檢查容器狀態
docker ps | grep code-server

# 重啟 code-server（如果需要）
docker restart code-server
```

### 8.3 無法連接資料庫

```bash
# 檢查 PostgreSQL 容器
docker ps | grep postgres

# 測試連接
psql -h 100.86.88.88 -p 5435 -U hermes -d hermes -c "SELECT 1"
```

---

## 9. 聯絡資訊

如果遇到問題：
1. 檢查 Docker 容器狀態
2. 檢查 Tailscale 連接
3. 查看 Docker 日誌

---

## Signature

```
Hermes OS 遠端開發指南
Version: 1.0
Date: 2026-07-27
Status: Active
```
