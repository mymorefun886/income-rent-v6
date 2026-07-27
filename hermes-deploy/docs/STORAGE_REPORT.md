# 儲存位置檢查報告

**日期**: 2026-07-27
**NAS**: Ugreen DXP4800 Plus (32GB DDR5)

---

## 1. Pool 使用情況

| Pool | 類型 | 容量 | 已用 | 可用 | 使用率 |
|------|------|------|------|------|--------|
| **Pool 1** | HDD RAID5 | 30TB | 1.2T | 28T | **5%** |
| **Pool 2** | SSD | 219GB | 248M | 219GB | **1%** |
| **Pool 3** | SSD | 219GB | 43M | 219GB | **1%** |

---

## 2. 目錄結構

### 2.1 Pool 1: Cold Data Lake (/volume1/hermes-cold/)

| 目錄 | 大小 | 用途 |
|------|------|------|
| backups | 1.2M | 資料庫備份 |
| education | 7.3M | 教育資料 |
| assets | 0 | 資產/圖片 |
| documents | 0 | 文件 |
| raw-data | 0 | 原始資料 |
| wiki | 0 | 知識庫 |

**其他目錄**：
- /volume1/hermes workspace/ - Firefox 工作區

### 2.2 Pool 2: AI Data Layer (/volume2/hermes-data/)

| 目錄 | 大小 | 用途 |
|------|------|------|
| postgres | 4K | PostgreSQL 資料庫 |
| qdrant | 108M | Qdrant 向量資料庫 |
| redis | 20K | Redis 快取 |

### 2.3 Pool 3: Runtime Layer (/volume3/hermes/)

| 目錄 | 大小 | 用途 |
|------|------|------|
| configs | - | 配置檔案 |
| deploy | - | 部署檔案 |
| hermes-studio-data | - | Studio 資料 |
| scripts | - | 腳本 |
| source | - | 源代碼 |

**其他目錄**：
- /volume3/docker/ - Docker 容器資料

---

## 3. 與原始設計對比

| 設計 | 實際 | 狀態 |
|------|------|------|
| Pool 1: /volume1/hermes-cold/ | /volume1/hermes-cold/ | ✅ 符合 |
| Pool 2: /volume2/hermes-data/ | /volume2/hermes-data/ | ✅ 符合 |
| Pool 3: /volume3/ | /volume3/hermes/ | ✅ 符合 |

---

## 4. 空間使用率評估

| Pool | 使用率 | 狀態 |
|------|--------|------|
| Pool 1 | 5% | ✅ 健康 |
| Pool 2 | 1% | ✅ 健康 |
| Pool 3 | 1% | ✅ 健康 |

**結論**：儲存空間充足，無需擔心。

---

## 5. Docker 容器儲存映射

| 容器 | 儲存位置 |
|------|----------|
| hermes-postgres | /volume2/hermes-data/postgres |
| hermes-qdrant | /volume2/hermes-data/qdrant |
| hermes-redis | /volume2/hermes-data/redis |
| code-server | /volume3/code-server |
| 其他容器 | /volume3/docker |

---

## 6. 備份狀態

| 項目 | 位置 | 狀態 |
|------|------|------|
| 資料庫備份 | /volume1/hermes-cold/backups/ | ✅ 存在 |
| 文檔備份 | /volume1/hermes-cold/documents/ | ✅ 存在 |
| 原始資料 | /volume1/hermes-cold/raw-data/ | ✅ 存在 |

---

## 7. 建議

### 7.1 目前無需修改
- 儲存配置正確
- 空間使用率健康
- 目錄結構符合設計

### 7.2 未來監控
- 定期檢查 Pool 1 使用增長（備份會持續增加）
- Pool 2/3 目前使用率極低，無需擔心

---

## Signature

```
儲存位置檢查報告
Version: 1.0
Date: 2026-07-27
Status: Healthy
```
