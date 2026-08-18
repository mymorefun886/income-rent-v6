#!/bin/bash
# 收租佬 V8 - NAS 部署腳本
# 在 NAS 上運行此腳本

set -e

echo "🏠 收租佬 V8 部署腳本"
echo "========================"

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安裝，請先在 NAS 安裝 Docker"
    exit 1
fi

# 檢查 docker-compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose 未安裝"
    exit 1
fi

# 創建環境變數文件
if [ ! -f .env ]; then
    echo "📝 創建 .env 文件..."
    cp .env.example .env
    echo "⚠️  請編輯 .env 文件設置 JWT_SECRET 和管理員密碼"
    echo "   按 Enter 繼續使用默認設置，或 Ctrl+C 取消後編輯"
    read
fi

# 創建存儲目錄
echo "📁 創建存儲目錄..."
mkdir -p storage/backups storage/uploads storage/wechatbot

# 構建映像
echo "🔨 構建 Docker 映像..."
docker-compose build

# 啟動服務
echo "🚀 啟動服務..."
docker-compose up -d

# 等待服務就緒
echo "⏳ 等待服務啟動..."
sleep 5

# 檢查狀態
echo ""
echo "📊 服務狀態："
docker-compose ps

echo ""
echo "✅ 部署完成！"
echo ""
echo "訪問地址："
echo "  Web 界面：http://192.168.9.2:8080"
echo "  API：http://192.168.9.2:8788/api"
echo ""
echo "默認管理員賬號：admin / admin123"
echo ""
echo "查看日誌：docker-compose logs -f"
echo "停止服務：docker-compose down"
