# rent8_wechat + V6 API 整合指南

## 方案 C：rent8 微信小程序 + V6 Web 管理端 + V6 API

### 架構

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  V6 Web 管理端   │     │ rent8 微信小程序 │     │   V6 API 後端    │
│  (React)        │     │ (TDesign)       │     │  (Hono+SQLite)  │
│                 │     │                 │     │                 │
│  房東使用        │     │  租戶使用        │     │  統一數據源      │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    共用 V6 API (端口 8788)
```

---

## 安裝步驟

### 1. 克隆 rent8_wechat

```bash
git clone -b 二房东 https://gitee.com/MarcoMaHH/rent8_wechat.git
cd rent8_wechat
npm install
```

### 2. 修改 API 端點

編輯 `miniprogram/app.js`：

```javascript
// 修改前
const apiUrl = "http://rent81.test/";

// 修改後（指向你的 V6 API）
const apiUrl = "http://192.168.9.2:8788/";  // 本地網絡
// 或
const apiUrl = "https://your-domain.com/";  // 公網域名
```

### 3. 修改請求格式

rent8_wechat 使用 `application/x-www-form-urlencoded`，V6 兼容 API 已支持。

無需修改 `app.js` 的 `call` 方法。

### 4. 微信開發者工具設置

1. 打開微信開發者工具
2. 導入項目，選擇 `rent8_wechat` 文件夾
3. 設置你的小程序 appid
4. 工具 → 構建 npm
5. 勾選「不校驗合法域名」（開發階段）

### 5. 啟動 V6 API

```bash
cd income-rent-v5
pnpm dev:api
```

---

## API 對照表

| rent8_wechat 功能 | rent8 原 API | V6 兼容 API | 狀態 |
|------------------|--------------|-------------|------|
| 登錄 | `POST api/user/login` | `POST api/user/login` | ✅ |
| 用戶信息 | `GET api/user/userinfo` | `GET api/user/userinfo` | ✅ |
| 房產列表 | `GET api/property/queryPropertyAll` | `GET api/property/queryPropertyAll` | ✅ |
| 房間列表 | `POST api/number/queryNumber` | `POST api/number/queryNumber` | ✅ |
| 賬單查詢 | `POST api/bill/queryBill` | `POST api/bill/queryBill` | ✅ |
| 未收賬單 | `POST api/uncollected/queryUncollected` | `POST api/uncollected/queryUncollected` | ✅ |
| 收據單詳情 | `POST api/uncollected/report` | `POST api/uncollected/report` | ✅ |
| 確認到賬 | `POST api/uncollected/account` | `POST api/uncollected/account` | ✅ |
| 退房 | `POST api/bill/checkout` | `POST api/bill/checkout` | ✅ |
| 費用項目 | `GET api/fee/queryFee` | `GET api/fee/queryFee` | ✅ |

---

## 租戶功能（小程序端）

| 功能 | 說明 |
|------|------|
| 查看賬租 | 租戶登錄後查看自己的賬單 |
| 查看收據 | 點擊賬單查看詳細收據 |
| 分享賬單 | 分享賬單到其他聊天 |
| 報修申請 | 提交維修申請（未來可擴展） |

---

## 房東功能（V6 Web 端）

| 功能 | 說明 |
|------|------|
| 房產管理 | 添加/編輯樓棟和房間 |
| 租客管理 | 租客檔案、合同 |
| 賬單生成 | 自動生成每月賬單 |
| 抄表管理 | 水電表抄表 |
| 工單管理 | 維修工單跟蹤 |
| 收支管理 | 記錄支出和收入 |
| 報表分析 | 月度/年度報表 |

---

## 數據同步

所有數據存儲在 V6 的 SQLite 數據庫中：

- V6 Web 管理端 → 直接寫入數據庫
- rent8_wechat 小程序 → 通過兼容 API 讀取/寫入

數據完全實時同步，無需額外同步機制。

---

## 常見問題

### Q: 小程序可以離線使用嗎？
A: 否，需要連接到 V6 API 服務器。

### Q: 可以部署到公網嗎？
A: 可以，需要：
1. 申請微信小程序
2. 申請公網域名（需 HTTPS）
3. 配置服務器安全組

### Q: 數據安全嗎？
A: V6 API 支持 JWT 認證，rent8_wechat 使用 session 驗證。

---

## 下一步

1. [ ] 測試 rent8_wechat 連接 V6 API
2. [ ] 添加租戶註冊功能
3. [ ] 添加微信支付功能
4. [ ] 添加推送通知
