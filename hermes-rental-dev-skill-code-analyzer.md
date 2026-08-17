# Skill: code-analyzer
# 代碼分析器 - 分析 V6 項目代碼結構、找出潛在問題

## 用途
分析 income-rent-v6 項目代碼，提供：
- 代碼結構概覽
- 潛在問題識別
- 優化建議
- 技術債清單

## 觸發條件
- 用戶要求「分析代碼」、「代碼審查」、「找出問題」
- 部署前檢查
- 性能問題排查

## 分析維度

### 1. 結構分析
```bash
# 項目結構
income-rent-v6/
├── apps/
│   ├── api/          # Hono 後端
│   │   └── src/
│   │       ├── db/   # Drizzle ORM + SQLite
│   │       ├── routes/
│   │       ├── services/
│   │       └── index.ts
│   └── web/          # React 前端
│       └── src/
│           ├── components/
│           ├── pages/
│           └── hooks/
├── packages/
│   ├── shared/       # 共享類型
│   └── ui/           # 共享組件
├── docker-compose.yml
└── pnpm-workspace.yaml
```

### 2. 代碼質量檢查清單

#### 後端 (apps/api)
- [ ] 路由是否正確處理錯誤（try-catch + HTTP 狀態碼）
- [ ] SQL 注入防護（Drizzle ORM 參數化查詢）
- [ ] JWT 驗證中間件是否覆蓋所有敏感路由
- [ ] 輸入驗證（zod schema）
- [ ] 日誌記錄完整性
- [ ] 異步錯誤處理（未捕獲的 Promise）

#### 前端 (apps/web)
- [ ] TypeScript 類型完整性（避免 `any`）
- [ ] React 性能（useMemo/useCallback 濫用）
- [ ] API 錯誤處理（統一 error boundary）
- [ ] 表單驗證
- [ ] 無障礙性（a11y）

#### 數據庫 (apps/api/src/db)
- [ ] Schema 正規化程度
- [ ] 索引設計（查詢頻繁的字段）
- [ ] 遷移文件完整性
- [ ] 外鍵約束

### 3. 常見問題模式

#### ❌ 避免的模式
```typescript
// 1. 濫用 any
const data: any = await req.json()

// 2. 未處理的 Promise
bot.initialize() // 沒有 await 或錯誤處理

// 3. 魔法數字
if (status === 3) // 應該用枚舉

// 4. 過度嵌套
if (a) {
  if (b) {
    if (c) {
      // 難以閱讀
    }
  }
}
```

#### ✅ 推薦模式
```typescript
// 1. 類型安全
const data = await req.json() as TenantInput

// 2. 錯誤處理
try {
  await bot.initialize()
} catch (err) {
  console.error('初始化失敗:', err)
}

// 3. 枚舉/常量
enum TenantStatus {
  Active = 'active',
  Inactive = 'inactive',
}

// 4. 提前返回
if (!a) return
if (!b) return
if (!c) return
// 主要邏輯
```

## 執行步驟

### Step 1: 收集信息（在 NAS 執行）
```bash
# 進入項目目錄
cd /volume1/docker/income-rent-v6

# 檢查 Git 狀態
git status
git log --oneline -10

# 安裝依賴
pnpm install

# 類型檢查
pnpm type-check
```

### Step 2: 結構掃描（在 NAS 執行）
```bash
# 列出所有路由
find apps/api/src/routes -name "*.ts" | sort

# 列出所有服務
find apps/api/src/services -name "*.ts" | sort

# 列出所有頁面
find apps/web/src/pages -name "*.tsx" | sort

# 統計代碼行數
find apps -name "*.ts" -o -name "*.tsx" | xargs wc -l
```

### Step 3: 問題檢測（在 NAS 執行）
```bash
# ESLint 檢查
pnpm lint

# TypeScript 嚴格檢查
pnpm type-check --strict

# 未使用的依賴
pnpm dlx depcheck

# 安全漏洞掃描
pnpm audit
```

### Step 4: 自癒優化

**如果 ESLint 錯誤超過 10 個**：
- 不要逐一報告
- 自動生成修復腳本 `fix-lint.sh`
- 內容示例：
```bash
#!/bin/bash
# 自動修復 ESLint 錯誤（需審核後執行）
pnpm lint --fix
# 手動修復項（需人工審核）
# 1. xxx.ts: 移除未使用的變量 yyy
# 2. zzz.tsx: 添加 useEffect 依賴
```
- 提示用戶審核後執行

### Step 5: 生成報告

報告格式：
```markdown
# 代碼分析報告

## 概覽
- 總代碼行數：X,XXX
- 文件數量：XXX
- TypeScript 覆蓋率：XX%

## 發現的問題

### 🔴 嚴重
1. [問題描述]
   - 位置：`apps/api/src/xxx.ts:123`
   - 建議：[修復方案]

### 🟡 警告
1. [問題描述]
   - 位置：`apps/web/src/xxx.tsx:45`
   - 建議：[修復方案]

### 🟢 建議
1. [優化建議]

## 技術債清單
1. [ ] 重構 X 模塊
2. [ ] 升級 Y 依賴
3. [ ] 補充 Z 測試

## 下一步行動
1. [優先級 1]
2. [優先級 2]
```

## 輸出路徑

**默認保存到 NAS**：
```
/volume1/docker/income-rent-v6/reports/code-analysis-YYYY-MM-DD.md
```

**可選：傳回 Windows 本地**（僅當用戶要求時）：
```bash
# 從 Windows 執行（在 NAS 生成報告後）
ssh morefun886@192.168.9.2 "cat /volume1/docker/income-rent-v6/reports/code-analysis-2026-08-17.md" > Z:\Backup\workspace\coding\income-rent-v6\reports\code-analysis-2026-08-17.md
```

## 注意事項
- 分析時不要修改代碼（只讀）
- 報告用繁體中文
- 提供具體的文件和行號
- 區分「必須修復」和「可選優化」
- 所有命令在 NAS（Linux）環境執行，路徑使用 Linux 格式
