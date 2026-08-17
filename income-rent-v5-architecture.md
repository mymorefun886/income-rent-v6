# 🏠 收租佬系统 V5.0 — 架构设计方案

> **前端开发者 Agent** | 2026-08-14 | 全面升级版本

---

## 📊 V4 现状诊断

### 技术栈
| 层级 | 当前技术 | 版本 |
|------|----------|------|
| 前端框架 | React | 18.2 |
| 构建工具 | Vite | 5.4.11 |
| 样式方案 | Tailwind CSS + shadcn/ui (Radix) | 3.4 |
| 状态管理 | React Query + Context | 5.48 |
| 后端运行时 | Node.js + 原生 http 模块 | 20+ |
| 数据库 | sql.js (WASM SQLite) | 1.14 |
| 部署 | Docker + Cloudflare Tunnel | - |

### 发现的核心问题

#### 1. 架构层面 ⚠️
- **巨型单文件后端**：`server.js` 194KB / 4000+ 行，维护困难
- **扁平化路由**：26 个路由文件复制粘贴严重，缺少统一抽象
- **数据层耦合**：`readDb/writeDb` 全局调用，无 Repository 模式
- **类型缺失**：后端纯 JS，无 TypeScript，重构风险高

#### 2. 性能问题 🐌
- **首屏 Bundle 748KB**：未做有效的 tree shaking
- **57 个 JS chunk**：过度分割，HTTP 请求过多
- **全量数据加载**：每次 `readDb()` 载入整个 JSON 到内存
- **无缓存策略**：每次页面切换都重新请求
- **sql.js WASM**：每次启动加载 2.9MB WASM 文件

#### 3. UI/UX 问题 🎨
- **shadcn/ui 组件堆砌**：视觉一致性差，缺少品牌个性
- **移动端适配不足**：虽然 viewport 设置正确，但交互未针对触屏优化
- **数据密集页面**：表格缺少虚拟化，大数据量卡顿
- **加载状态粗糙**：缺少骨架屏、乐观更新
- **无障碍缺失**：无 ARIA、键盘导航、屏幕阅读器支持

#### 4. 功能缺失 📋
- **无多用户**：单管理员模式，无法团队协作
- **无离线能力**：网络断开即不可用
- **无数据同步**：多设备数据不一致
- **无版本历史**：删除后无法恢复（虽有 audit log 但无 UI）

---

## 🎯 V5 设计目标

### 核心原则
1. **性能第一** — Lighthouse 性能分 > 95
2. **移动优先** — 所有页面针对触屏优化
3. **类型安全** — 全栈 TypeScript
4. **离线优先** — Service Worker + IndexedDB
5. **无障碍合规** — WCAG 2.1 AA

### 量化指标
| 指标 | V4 现状 | V5 目标 |
|------|---------|---------|
| 首屏加载时间 | ~3.5s | < 1.5s |
| Lighthouse 性能分 | ~65 | > 95 |
| 主 Bundle 大小 | 748KB | < 200KB |
| 无障碍合规 | 0% | 100% AA |
| 移动端体验 | 勉强可用 | 原生 App 级 |
| TypeScript 覆盖 | 0% | 100% |

---

## 🏗️ V5 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        客户端 (Browser)                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  React 18   │  │  TanStack   │  │     Service Worker      │ │
│  │  + Suspense │  │  Query +    │  │  + IndexedDB (离线)     │ │
│  │  + Router   │  │  Persist    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                          API 层 (Edge)                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Hono.js    │  │  Zod        │  │     JWT + RBAC          │ │
│  │  (轻量快速) │  │  验证      │  │     (多用户)            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                       数据层 (SQLite)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  better-    │  │  Drizzle    │  │     自动备份            │ │
│  │  sqlite3    │  │  ORM       │  │     + 版本控制          │ │
│  │  (原生)     │  │            │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 前端技术栈

```typescript
// 核心技术
{
  "framework": "React 18.3 + TypeScript 5.4",
  "build": "Vite 5 + Rollup",
  "styling": "Tailwind CSS 3.4 + CSS Variables",
  "state": "TanStack Query 5 + Zustand",
  "router": "TanStack Router 1 (类型安全路由)",
  "forms": "React Hook Form + Zod",
  "ui": "自定义组件库 (基于 Radix primitives)",
  "charts": "Recharts 2",
  "pwa": "vite-plugin-pwa",
  "testing": "Vitest + Testing Library + Playwright"
}
```

### 后端技术栈

```typescript
{
  "runtime": "Node.js 22 (LTS)",
  "framework": "Hono 4 (轻量、快速、TypeScript 原生)",
  "orm": "Drizzle ORM (类型安全 SQL)",
  "database": "better-sqlite3 (原生同步，比 sql.js 快 10x)",
  "validation": "Zod (前后端共享 schema)",
  "auth": "JWT + bcrypt + RBAC",
  "storage": "本地文件系统 + 自动备份",
  "deployment": "Docker + Cloudflare Tunnel"
}
```

---

## 📁 项目结构

```
income-rent-v5/
├── apps/
│   ├── web/                          # 前端应用
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # 基础 UI 组件 (Button, Input, Dialog)
│   │   │   │   ├── forms/            # 表单组件
│   │   │   │   ├── data/             # 数据展示组件 (Table, Card, List)
│   │   │   │   └── layout/           # 布局组件 (Sidebar, Header, MobileNav)
│   │   │   ├── features/             # 功能模块 (按业务划分)
│   │   │   │   ├── dashboard/
│   │   │   │   ├── properties/
│   │   │   │   ├── tenants/
│   │   │   │   ├── contracts/
│   │   │   │   ├── records/
│   │   │   │   ├── payments/
│   │   │   │   ├── expenses/
│   │   │   │   ├── work-orders/
│   │   │   │   ├── meter/
│   │   │   │   └── reports/
│   │   │   ├── hooks/                # 自定义 hooks
│   │   │   ├── lib/                  # 工具函数
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── types/                # TypeScript 类型定义
│   │   │   ├── routes/               # TanStack Router 路由
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── public/
│   │   └── index.html
│   │
│   └── api/                          # 后端 API
│       ├── src/
│       │   ├── routes/               # 路由定义
│       │   ├── controllers/          # 控制器
│       │   ├── services/             # 业务逻辑
│       │   ├── repositories/         # 数据访问层
│       │   ├── db/
│       │   │   ├── schema.ts         # Drizzle schema
│       │   │   ├── migrate.ts        # 迁移
│       │   │   └── seed.ts           # 种子数据
│       │   ├── middleware/           # 中间件
│       │   ├── utils/                # 工具函数
│       │   ├── types/                # 类型定义
│       │   └── index.ts
│       └── storage/                  # SQLite 数据库文件
│
├── packages/
│   ├── shared/                       # 共享类型和工具
│   │   ├── src/
│   │   │   ├── schemas/              # Zod schemas (前后端共享)
│   │   │   ├── types/                # TypeScript 类型
│   │   │   └── constants/            # 常量
│   │   └── package.json
│   │
│   └── ui/                           # 共享 UI 组件库
│       ├── src/
│       └── package.json
│
├── docker-compose.yml
├── turbo.json                        # Monorepo 配置
└── package.json
```

---

## ⚡ 性能优化策略

### 1. 构建优化

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心框架单独分包
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 图表库懒加载
          'chart-vendor': ['recharts'],
          // UI 组件按需加载
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu']
        }
      }
    }
  },
  // 预构建依赖优化
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query']
  }
})
```

### 2. 运行时优化

```typescript
// 1. 虚拟化长列表
import { useVirtualizer } from '@tanstack/react-virtual'

function TenantList({ tenants }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: tenants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10
  })
  // 只渲染可视区域 + overscan
}

// 2. 乐观更新
const mutation = useMutation({
  mutationFn: updateTenant,
  onMutate: async (newData) => {
    await queryClient.cancelQueries(['tenants'])
    const previous = queryClient.getQueryData(['tenants'])
    queryClient.setQueryData(['tenants'], (old) => 
      old.map(t => t.id === newData.id ? newData : t)
    )
    return { previous }
  },
  onError: (_, __, context) => {
    queryClient.setQueryData(['tenants'], context.previous)
  }
})

// 3. 预取
const prefetchTenant = (id: string) => {
  queryClient.prefetchQuery({
    queryKey: ['tenant', id],
    queryFn: () => fetchTenant(id),
    staleTime: 60_000
  })
}
```

### 3. 离线优先 (Service Worker)

```typescript
// vite-plugin-pwa 配置
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    runtimeCaching: [
      {
        urlPattern: /\/api\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 86400 }
        }
      }
    ]
  },
  manifest: {
    name: '收租佬系统 V5',
    short_name: '收租佬',
    themeColor: '#3b82f6',
    icons: [...]
  }
})
```

---

## 🎨 UI/UX 设计系统

### 设计理念
- **清晰的信息层级** — 卡片 + 留白 + 阴影
- **数据可视化优先** — 关键指标一目了然
- **触控友好** — 最小 44px 触控区域
- **深色模式** — 系统级支持

### 颜色系统 (CSS Variables)

```css
:root {
  /* 主色调 - 专业蓝 */
  --primary: 221 83% 53%;
  --primary-foreground: 0 0% 100%;

  /* 功能色 */
  --success: 142 76% 36%;    /* 已收 */
  --warning: 38 92% 50%;     /* 待收 */
  --destructive: 0 84% 60%;  /* 欠租 */

  /* 中性色 */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --border: 214 32% 91%;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
}

.dark {
  --background: 222 47% 6%;
  --foreground: 210 40% 98%;
}
```

### 组件设计原则

```typescript
// 1. 组合式组件 (Compound Pattern)
<Card>
  <CardHeader>
    <CardTitle>租客列表</CardTitle>
    <CardDescription>共 24 位活跃租客</CardDescription>
  </CardHeader>
  <CardContent>
    <DataTable data={tenants} columns={columns} />
  </CardContent>
  <CardFooter>
    <Pagination total={100} pageSize={10} />
  </CardFooter>
</Card>

// 2. 数据状态组件 (Data State Pattern)
<DataState
  isLoading={isLoading}
  isError={isError}
  isEmpty={data.length === 0}
  loadingSkeleton={<TenantSkeleton />}
  errorState={<ErrorRetry onRetry={refetch} />}
  emptyState={<EmptyTenant onCreate={openCreate} />}
>
  <TenantTable data={data} />
</DataState>

// 3. 响应式布局
function PageLayout() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard title="总应收" value={stats.receivable} />
      <StatCard title="已收" value={stats.received} trend="+12%" />
      <StatCard title="未收" value={stats.unpaid} trend="-5%" />
      <StatCard title="利润率" value={stats.profitRate} />
    </div>
  )
}
```

### 移动端优化

```typescript
// 底部导航栏 (移动端)
<MobileNav>
  <MobileNavItem icon={Home} label="首页" to="/" />
  <MobileNavItem icon={Building} label="房源" to="/properties" />
  <MobileNavItem icon={Users} label="租客" to="/tenants" />
  <MobileNavItem icon={Receipt} label="账单" to="/records" />
  <MobileNavItem icon={MoreHorizontal} label="更多" to="/menu" />
</MobileNav>

// 滑动手势
import { useSwipe } from '@/hooks/useSwipe'

function TenantCard({ tenant, onEdit, onDelete }) {
  const handlers = useSwipe({
    onSwipeLeft: () => onDelete(tenant.id),
    onSwipeRight: () => onEdit(tenant.id)
  })
  return <Card {...handlers}>...</Card>
}
```

---

## ♿ 无障碍实现

### WCAG 2.1 AA 合规清单

```typescript
// 1. 语义化 HTML + ARIA
<nav aria-label="主导航">
  <ul role="list">
    <li><Link to="/dashboard" aria-current="page">首页</Link></li>
  </ul>
</nav>

// 2. 键盘交互
function DropdownMenu() {
  useKeyboardShortcut({
    'Escape': close,
    'ArrowDown': focusNext,
    'ArrowUp': focusPrevious,
    'Enter': selectFocused
  })
}

// 3. 焦点管理
<Dialog onOpenChange={open => {
  if (open) {
    // 打开时聚焦到第一个可聚焦元素
    focusTrap.activate()
  } else {
    // 关闭时触发焦点回到
    triggerRef.current?.focus()
  }
}}>

// 4. 屏幕阅读器 announcer
const announcer = useAnnouncer()
announcer.notify('租客张三已成功添加', 'polite')

// 5. 颜色对比度验证
// 所有文本颜色通过工具验证 ≥ 4.5:1 (AA)
// 大文本 ≥ 3:1
```

---

## 🔐 多用户 + RBAC (V5 新功能)

### 角色定义

```typescript
enum Role {
  ADMIN = 'admin',      // 全部权限
  MANAGER = 'manager',  // 不能删除数据、不能改设置
  STAFF = 'staff',      // 只能查看和添加
  VIEWER = 'viewer'     // 只读
}

// 权限矩阵
const permissions = {
  'property:create': ['admin', 'manager', 'staff'],
  'property:delete': ['admin'],
  'tenant:create': ['admin', 'manager', 'staff'],
  'tenant:delete': ['admin'],
  'record:export': ['admin', 'manager'],
  'settings:modify': ['admin']
}
```

### JWT 认证

```typescript
// 登录响应
interface AuthResponse {
  accessToken: string;   // 15 分钟
  refreshToken: string;  // 7 天
  user: {
    id: string;
    username: string;
    role: Role;
  };
}

// 请求拦截器
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

---

## 📊 数据库 Schema (Drizzle ORM)

```typescript
// db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  areaSqm: real('area_sqm'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  createdBy: text('created_by').references(() => users.id)
})

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  idCard: text('id_card'),
  propertyId: text('property_id').references(() => properties.id),
  roomLabel: text('room_label'),
  depositAmount: real('deposit_amount').default(0),
  leaseStart: integer('lease_start', { mode: 'timestamp' }),
  leaseEnd: integer('lease_end', { mode: 'timestamp' }),
  archived: integer('archived', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

export const records = sqliteTable('records', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').references(() => tenants.id),
  cycle: text('cycle').notNull(),  // '2026-08'
  receivable: real('receivable').notNull(),
  received: real('received').default(0),
  status: text('status').default('unpaid'),  // unpaid | paid | partial
  sentStatus: text('sent_status').default('unsent'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
})

export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  category: text('category').notNull(),
  amount: real('amount').notNull(),
  payee: text('payee'),
  paymentMethod: text('payment_method'),
  propertyId: text('property_id').references(() => properties.id),
  workOrderId: text('work_order_id').references(() => workOrders.id),
  note: text('note')
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').default('viewer'),
  lastLogin: integer('last_login', { mode: 'timestamp' })
})
```

---

## 🚀 实施路线图

### 阶段 1: 基础搭建 (2 周)
- [ ] Monorepo 初始化 (Turborepo + pnpm)
- [ ] 后端框架 (Hono + Drizzle + better-sqlite3)
- [ ] 数据库 schema + 迁移
- [ ] API 基础 CRUD (properties, tenants, records)
- [ ] 认证系统 (JWT + 登录页)

### 阶段 2: 核心功能 (3 周)
- [ ] 前端框架 (React + TanStack Router + Query)
- [ ] UI 组件库基础 (Button, Input, Card, Dialog, Table)
- [ ] Dashboard 页面
- [ ] 房源管理 CRUD
- [ ] 租客管理 CRUD
- [ ] 账单/台账管理

### 阶段 3: 高级功能 (3 周)
- [ ] 合同管理 + 到期提醒
- [ ] 收款记录 + 对账
- [ ] 支出管理
- [ ] 工单系统
- [ ] 抄表管理
- [ ] 报表分析 (图表)

### 阶段 4: 优化与扩展 (2 周)
- [ ] 移动端适配优化
- [ ] PWA + Service Worker
- [ ] 深色模式
- [ ] 无障碍审计
- [ ] 性能优化 (代码分割、缓存)
- [ ] 多用户 RBAC

### 阶段 5: 测试与部署 (1 周)
- [ ] 单元测试 (Vitest)
集成测试 (Playwright)
- [ ] E2E 测试 (关键流程)
- [ ] Docker 镜像构建
- [ ] 数据迁移脚本 (V4 → V5)
- [ ] 上线部署

**总预计时间: 11 周**

---

## 📦 V4 → V5 数据迁移

```typescript
// scripts/migrate-v4-to-v5.ts
import { readFileSync } from 'fs'
import { db } from '../apps/api/src/db'
import { properties, tenants, records } from '../apps/api/src/db/schema'

async function migrate() {
  const v4db = JSON.parse(readFileSync('v4-export.json', 'utf8'))

  // 1. 迁移房源
  for (const prop of v4db.properties) {
    await db.insert(properties).values({
      id: prop.id,
      name: prop.name,
      // ... 字段映射
    })
  }

  // 2. 迁移租客
  for (const tenant of v4db.tenants) {
    await db.insert(tenants).values({...})
  }

  // 3. 迁移账单
  for (const record of v4db.records) {
    await db.insert(records).values({...})
  }

  console.log('迁移完成!')
}
```

---

## ✅ 成功指标

| 指标 | 目标 | 验证方式 |
|------|------|----------|
| Lighthouse 性能分 | > 95 | `npx lighthouse` |
| Lighthouse 无障碍分 | > 95 | `npx lighthouse` |
| 首屏加载 (4G) | < 1.5s | WebPageTest |
| 主 Bundle 大小 | < 200KB (gzip) | `vite build` |
| TypeScript 类型覆盖 | 100% | `tsc --noEmit` |
| 单元测试覆盖率 | > 80% | `vitest --coverage` |
| E2E 关键流程 | 100% 通过 | Playwright |
| 移动端体验评分 | > 90 | Lighthouse mobile |

---

**前端开发者 Agent**
**设计日期**: 2026-08-14
**性能**: 针对 Core Web Vitals 卓越表现进行优化
**无障碍**: 符合 WCAG 2.1 AA 标准的包容性设计
**架构**: 类型安全、可扩展、离线优先
