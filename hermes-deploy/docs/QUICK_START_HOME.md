# 家中 PC 快速上手指南

**目標**: 在家中 PC 使用 Claude Code Desktop 繼續 Hermes OS 開發

---

## 前置條件

- ✅ 香港 PC 已安裝 Claude Code
- ✅ 已安裝 Git
- ✅ 已安裝 Tailscale

---

## Step 1: 連接 Tailscale

```bash
# 啟動 Tailscale
tailscale up

# 確認連接狀態
tailscale status

# 應該能看到 NAS: 100.86.88.88
```

**驗證連通性**：
```bash
ping 100.86.88.88
```

---

## Step 2: 克隆倉庫

```bash
# 打開 Git Bash 或 PowerShell
cd D:\Cowork

# 克隆倉庫
git clone https://github.com/mymorefun886/hermes-os.git

# 進入目錄
cd hermes-os
```

**如果已有倉庫，更新代碼**：
```bash
cd D:\Cowork\hermes-os
git pull origin master
```

---

## Step 3: 查看進度

### 3.1 查看 Git 提交歷史

```bash
# 查看提交記錄
git log --oneline

# 輸出範例：
# dcf4d1b Add comprehensive progress report
# 14bb154 Initial commit: Hermes OS Education Engine Phase 10.4
```

### 3.2 查看進度報告

```bash
# 打開進度報告
cat hermes-deploy/docs/PROGRESS_REPORT.md
```

**或在瀏覽器打開**：
https://github.com/mymorefun886/hermes-os/blob/master/hermes-deploy/docs/PROGRESS_REPORT.md

### 3.3 查看目前分支狀態

```bash
git status
git branch -a
```

---

## Step 4: 訪問 NAS 服務

| 服務 | 地址 | 說明 |
|------|------|------|
| code-server | http://100.86.88.88:8080 | 瀏覽器 IDE |
| PostgreSQL | 100.86.88.88:5435 | 資料庫 |
| Qdrant | http://100.86.88.88:6333 | 向量資料庫 |
| Hermes API | http://100.86.88.88:8642 | API 閘道 |
| Hermes Studio | http://100.86.88.88:6060 | Web UI |

**測試 API**：
```bash
curl http://100.86.88.88:8642/health
```

---

## Step 5: 啟動 Claude Code Desktop

```bash
cd D:\Cowork\hermes-os
claude
```

**Claude Code 啟動後會問你**：
- 選擇工作目錄：選擇 `hermes-deploy`
- 確認信任：選擇 "Yes, proceed"

---

## Step 6: 立馬上手工作

### 6.1 當前可執行任務

| 優先級 | 工作 | 說明 |
|--------|------|------|
| 1 | Admission Network 資料匯入 | 需要 EDB 學校網資料 |
| 2 | Layer 3 Through-train Graph | 一條龍學校名單 |
| 3 | Shared Memory Layer | Memory 表格 + API |

### 6.2 立即可做的任務

**任務 1：查看 Admission Network 資料模板**
```bash
cat hermes-deploy/docs/school_network_data_template.md
```

**任務 2：檢查資料庫連接**
```bash
# 透過 Tailscale 連接 PostgreSQL
psql -h 100.86.88.88 -p 5435 -U hermes -d hermes

# 測試查詢
SELECT COUNT(*) FROM memory.school_entity_master;
SELECT COUNT(*) FROM memory.school_entity_mapping;
SELECT COUNT(*) FROM memory.school_profile_evidence;
```

**任務 3：檢查 Qdrant 狀態**
```bash
curl http://100.86.88.88:6333/collections
```

---

## 常用指令

### Git 操作
```bash
# 拉取最新代碼
git pull origin master

# 提交更改
git add .
git commit -m "your message"
git push origin master

# 查看狀態
git status
git log --oneline
```

### 資料庫操作
```bash
# 連接 PostgreSQL
psql -h 100.86.88.88 -p 5435 -U hermes -d hermes

# 常用查詢
SELECT COUNT(*) FROM memory.school_entity_master;
SELECT COUNT(*) FROM memory.school_entity_mapping;
SELECT * FROM memory.entity_resolution_exception;
```

### Docker 操作（NAS）
```bash
# SSH 到 NAS（如果需要）
ssh root@100.86.88.88

# 查看容器狀態
docker ps

# 查看日誌
docker logs hermes-gateway
docker logs hermes-core
```

---

## 開發流程

```
家中 PC (Claude Code Desktop)
        │
        ├── 1. git pull origin master（獲取最新代碼）
        │
        ├── 2. 編輯代碼 / Claude Code 協助
        │
        ├── 3. git add / commit / push
        │
        ├── 4. 測試（透過 Tailscale 訪問 NAS 服務）
        │
        └── 5. 重複
```

---

## 安全注意事項

### 不要做的事
- ❌ 不要重啟 NAS Docker 容器
- ❌ 不要直接修改 `/volume2` 或 `/volume3`
- ❌ 不要暴露 NAS 埠口到外網
- ❌ 不要在 code-server 中使用 root 權限

### 應該做的事
- ✅ 使用 Claude Code Desktop 開發
- ✅ 使用 Tailscale 連接
- ✅ 使用 pgAdmin 或 psql 訪問資料庫
- ✅ 定期備份資料

---

## 問題排查

### 無法連接 Tailscale
```bash
tailscale status
tailscale down
tailscale up
```

### 無法克隆倉庫
```bash
# 檢查 Git 配置
git config --global user.name
git config --global user.email

# 設置 Git 配置
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### 無法訪問 NAS 服務
```bash
# 檢查 Tailscale 連接
ping 100.86.88.88

# 檢查服務狀態
curl http://100.86.88.88:8642/health
```

---

## 快速檢查清單

在開始工作前，確認以下事項：

- [ ] Tailscale 已連接（`tailscale status`）
- [ ] 倉庫已克隆（`git clone`）
- [ ] 代碼已更新（`git pull`）
- [ ] NAS 服務可訪問（`curl http://100.86.88.88:8642/health`）
- [ ] Claude Code 已啟動（`claude`）

---

## 相關連結

| 資源 | URL |
|------|-----|
| GitHub 倉庫 | https://github.com/mymorefun886/hermes-os |
| 進度報告 | `hermes-deploy/docs/PROGRESS_REPORT.md` |
| 遠端開發指南 | `hermes-deploy/docs/remote_development_guide.md` |
| 學校網資料模板 | `hermes-deploy/docs/school_network_data_template.md` |

---

## Signature

```
Hermes OS 家中 PC 快速上手指南
Version: 1.0
Date: 2026-07-27
Status: Active
```
