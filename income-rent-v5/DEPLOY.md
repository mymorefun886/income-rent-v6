# 收租佬 V6 - NAS 部署指南

## 系統架構

```
┌─────────────────────────────────────────────────────────┐
│  NAS (192.168.9.2)                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ income-web  │  │ income-api  │  │   SQLite DB     │  │
│  │   :8080     │──│   :8788     │──│  ./storage/     │  │
│  │   (Nginx)   │  │   (Node.js) │  │  rental.db      │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
│        │                                                  │
│        ▼                                                  │
│  http://192.168.9.2:8080                                  │
└─────────────────────────────────────────────────────────┘
```

## 快速部署

### 1. 上傳項目到 NAS

```bash
# 在 NAS 上
cd /volume1/docker/  # 或你的 Docker 目錄
git clone <repository-url> income-rent-v6
cd income-rent-v6
```

或者通過 SMB 複製：
```
\\192.168.9.2\hermes-agent\backup\workspace\coding\income-rent-v5
```

### 2. 創建環境變數文件

```bash
cp .env.example .env
nano .env  # 修改 JWT_SECRET 和管理員密碼
```

### 3. 構建並啟動

```bash
# 構建映像
docker-compose build

# 啟動服務
docker-compose up -d

# 查看日誌
docker-compose logs -f
```

### 4. 訪問系統

- Web 界面：http://192.168.9.2:8080
- API：http://192.168.9.2:8788/api
- 默認管理員：admin / admin123

## 數據備份

數據庫位置：`./storage/rental.db`

```bash
# 備份
cp storage/rental.db storage/backups/rental-$(date +%Y%m%d).db

# 或通過 API
curl -X POST http://localhost:8788/api/admin/backup \
  -H "Authorization: Bearer <token>"
```

## 常見操作

```bash
# 停止服務
docker-compose down

# 重啟服務
docker-compose restart

# 查看狀態
docker-compose ps

# 更新代碼後重新部署
git pull
docker-compose build
docker-compose up -d

# 進入容器調試
docker exec -it income-api-v6 sh
```

## 端口配置

| 服務 | 端口 | 說明 |
|------|------|------|
| Web 前端 | 8080 | Nginx 靜態文件 + API 代理 |
| API 后端 | 8788 | Hono REST API |

如果端口衝突，修改 `docker-compose.yml` 中的 `ports`：
```yaml
ports:
  - "新端口:8080"  # Web
  - "新端口:8788"  # API
```

## 與現有服務並存

NAS 現有服務：
- Hermes Studio: :6060
- Hermes API: :8642
- code-server: :8080 ← **衝突！**

如果 :8080 已被佔用，請修改 Web 端口為其他（如 :8081）。

## 微信 Bot 配置

微信 Bot 憑證存儲在 `./storage/wechatbot/` 目錄。

首次使用：
1. 訪問 http://192.168.9.2:8080/wechat-bot
2. 點擊「掃碼登錄」
3. 用手機微信掃碼

## 故障排除

### 容器無法啟動
```bash
docker-compose logs api
docker-compose logs web
```

### 數據庫鎖定
```bash
# 停止容器
docker-compose down

# 修復數據庫
sqlite3 storage/rental.db ".backup storage/rental-backup.db"

# 重啟
docker-compose up -d
```

### 端口被佔用
```bash
# 查看端口使用情況
netstat -tlnp | grep 8080
netstat -tlnp | grep 8788
```
