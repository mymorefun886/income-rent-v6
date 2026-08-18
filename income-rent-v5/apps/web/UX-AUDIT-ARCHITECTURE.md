# 收租佬 V8 全站 UX 审计 + 架构方案

**审计日期**: 2026-08-18
**审计范围**: `income-rent-v5/apps/web` (React 18 + TanStack Router + Tailwind + shadcn/ui)
**线上地址**: https://income.ccwu.cc/
**审计方法**: 源码静态分析（站点需登录，403）

---

## 1. 执行摘要

### 系统定位
收租佬 V8 是面向个人房东/小型租赁管理者的 SaaS 租务系统，管理房源、租客、合同、账单、抄表、收支、工单等全链路。部署在 NAS，通过 Cloudflare Tunnel 暴露，主要用户在手机/平板上操作。

### 技术栈（已确认）
| 层 | 技术 |
|----|------|
| 框架 | React 18 + TypeScript + Vite |
| 路由 | TanStack Router（文件路由） |
| 样式 | Tailwind CSS 3.4 + CSS Custom Properties |
| 组件 | shadcn/ui (Radix primitives) + CVA |
| 状态 | Zustand (auth/theme) + TanStack Query (服务端状态) |
| 图表 | Recharts |
| 动画 | Framer Motion |
| 图标 | Lucide React |
| PWA | vite-plugin-pwa |

### 审计结论（TL;DR）

| 维度 | 评级 | 一句话 |
|------|------|--------|
| 设计系统基础 | **B+** | Token 体系完整，但组件覆盖不足 |
| 信息架构 | **C+** | 18 项平铺导航，认知负荷高 |
| 交互一致性 | **C** | 表单控件混用原生/shadcn，模态框手写 |
| 响应式 | **B-** | 有移动端侧栏，但表格无适配策略 |
| 无障碍 | **B-** | 有 skip link + focus-visible，但模态框缺 ARIA |
| 暗色主题 | **A-** | 系统级方案完整，仅图表颜色硬编码 |

**核心问题**：基础设施（Token、主题、路由）搭好了，但**组件层有缺口**——开发者在页面里大量手写表单控件和模态框，而不是用已有的 shadcn 组件。这导致不一致、难维护、无障碍欠债。

---

## 2. 信息架构审计

### 2.1 当前导航结构（18 项平铺）

```
首页 (Dashboard)
房源 (Properties)
租客 (Tenants)
合同 (Contracts)
账单 (Records)
收款 (Payments)
交易 (Transactions)
支出 (Expenses)
工单 (Work Orders)
手机抄表 (Meter Input)
水电费盈亏 (Utility Bills)
抄表管理 (Meter Drafts)
消息日志 (Message Logs)
微信 Bot (WeChat Bot)
收據單 (Receipts)
提醒 (Reminders)
报表 (Reports)
设置 (Settings)
```

### 2.2 问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| 18 项无分组 | 新用户认知负荷高，找不到功能 | 🔴 高 |
| 无层级关系 | "账单/收款/交易/支出" 是什么关系？用户困惑 | 🔴 高 |
| 无使用频率排序 | 高频功能（账单、收款）与低频（微信 Bot）同级 | 🟡 中 |
| 无最近访问/快捷入口 | 每次都要在 18 项里找 | 🟡 中 |
| 无搜索 | 功能多了以后没法快速定位 | 🟡 中 |

### 2.3 建议的信息架构（分组 + 层级）

按用户心智模型重新分组，**一级导航压缩到 5 个**，其余收进二级菜单：

```
┌─────────────────────────────────────────────────────────────┐
│  📊 首页 (Dashboard)                                         │
├─────────────────────────────────────────────────────────────┤
│  🏠 租务管理                                                │
│     ├── 房源                                                │
│     ├── 租客                                                │
│     ├── 合同                                                │
│     └── 工单                                                │
├─────────────────────────────────────────────────────────────┤
│  💰 财务管理                                                │
│     ├── 账单                                                │
│     ├── 收款                                                │
│     ├── 交易                                                │
│     ├── 支出                                                │
│     └── 收據單                                              │
├─────────────────────────────────────────────────────────────┤
│  ⚡ 抄表 & 水电                                             │
│     ├── 手机抄表                                            │
│     ├── 抄表管理                                            │
│     └── 水电费盈亏                                          │
├─────────────────────────────────────────────────────────────┤
│  📣 沟通 & 自动化                                           │
│     ├── 提醒                                                │
│     ├── 消息日志                                            │
│     └── 微信 Bot                                            │
├─────────────────────────────────────────────────────────────┤
│  📈 报表                                                    │
│  ⚙️ 设置                                                    │
└─────────────────────────────────────────────────────────────┘
```

**收益**：
- 一级导航从 18 → 7（含 2 个独立入口），侧栏宽度不变
- 符合房东心智模型：租务 → 财务 → 抄表 → 沟通
- 未来加新功能有明确归属位置

---

## 3. UX 发现（按严重度排序）

### 🔴 P0 — 影响核心任务流程

#### 3.1 表单控件不一致

**现状**：Properties 和 Records 页面混用三种表单控件：
- ✅ shadcn `Input` 组件（有 focus ring、错误状态）
- ❌ 原生 `<select>` + 手写 Tailwind class（`className="w-full px-3 py-2 border rounded-md bg-background"`）
- ❌ 原生 `<input>` + 手写 class
- ❌ 原生 `<textarea>` + 手写 class

**问题**：
- 视觉不一致（原生 select 在不同浏览器/OS 下外观不同）
- 无障碍缺失（原生控件没有关联 label、没有 aria-invalid）
- 暗色主题下原生控件可能不继承 CSS 变量
- 代码重复（同一个 class 字符串出现 30+ 次）

**建议**：
- 补齐 shadcn `Select`、`Textarea`、`Checkbox` 组件（Radix 已有 primitives）
- 所有表单统一用 shadcn 组件
- 建立 `FormField` 包装器（label + control + error + hint）

#### 3.2 模态框手写，缺无障碍

**现状**：所有模态框都是 `fixed inset-0 bg-black/50` 手写，包括：
- Properties 编辑模态框
- Records 查看/编辑/快速收款 3 个模态框
- 删除确认 `confirm()`
- 微信发送 `prompt()`

**缺失**：
- ❌ 无 focus trap（Tab 键会跳出模态框）
- ❌ 无 Escape 关闭
- ❌ 无 `role="dialog"` + `aria-modal="true"`
- ❌ 无 `aria-labelledby` 关联标题
- ❌ 无 scroll lock（背景仍可滚动）
- ❌ 无进入/退出动画

**已有资源**：`@radix-ui/react-dialog` 已安装但未使用。

**建议**：
- 所有模态框迁移到 shadcn `Dialog`（基于 Radix Dialog）
- 删除确认用 `AlertDialog` 变体
- 移除所有 `confirm()` / `prompt()` 调用

#### 3.3 删除操作无撤销

**现状**：`if (confirm('确定删除吗？')) { deleteMutation.mutate() }`

**问题**：
- 误触无法撤回
- `confirm()` 阻塞主线程
- 无 loading 态（用户不知道是否删了）

**建议**：
- 删除后用 Toast 提示"已删除"，带"撤销"按钮（5 秒）
- 或用软删除 + 回收站模式

---

### 🟡 P1 — 影响效率和一致性

#### 3.4 主题切换器是循环按钮

**现状**：`ThemeToggle` 是单按钮循环 `light → dark → system → light`。

**问题**：
- 用户不知道有其他 2 个选项（无 discoverability）
- 不知道当前是 system 模式还是手动模式
- 违反 Nielsen 启发式"可见的系统状态"

**建议**：
- 改为分段控制器（segmented control）或下拉菜单，同时显示 3 个选项
- 当前激活项高亮
- 参考：GitHub、Vercel、Linear 的主题切换

#### 3.5 图表颜色硬编码

**现状**：Dashboard `COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']`

**问题**：
- 暗色主题下颜色不自适应
- 与设计 Token 脱节
- 无法在 CSS 中复用

**建议**：
- 用 CSS 变量：`hsl(var(--chart-1))` ~ `hsl(var(--chart-5))`
- globals.css 已定义 `--chart-1` ~ `--chart-5`，直接用

#### 3.6 状态颜色无语义 Token

**现状**：
- Properties: `bg-green-500` / `bg-yellow-500` / `bg-blue-500`
- Records: `bg-green-100 text-green-700` / `bg-yellow-100 text-yellow-700` / `bg-red-100 text-red-700`

**问题**：
- 硬编码 Tailwind 颜色，暗色主题下可能对比度不足
- 同一状态在不同页面颜色不同（"已出租" vs "已收"）

**建议**：
- 用已定义的 `--success` / `--warning` / `--destructive` / `--info` Token
- 创建语义化 Badge variant：`Badge variant="success"` / `variant="warning"` / `variant="destructive"`

#### 3.7 无 Toast 反馈系统

**现状**：`@radix-ui/react-toast` 已安装，但**零使用**。Mutation 成功/失败无反馈。

**问题**：
- 用户不知道保存是否成功
- 微信发送失败用 `alert()`（阻塞）

**建议**：
- 封装 `useToast` hook
- 所有 mutation 自动触发 success/error toast
- 全局错误边界捕获未处理异常

#### 3.8 表格无响应式策略

**现状**：Records 页面用 `overflow-x-auto` 横向滚动表格。

**问题**：
- 手机上横向滚动 10 列数据，体验差
- 无列优先级（哪些在手机端隐藏）
- 无卡片视图备选

**建议**：
- 定义列优先级（高/中/低），手机端只显示高优先级列
- 或切换为卡片列表视图（每行 = 一张卡片）
- 参考：GitHub Issues 表格 → 卡片切换

---

### 🟢 P2 — 锦上添花

#### 3.9 侧栏无折叠模式

**现状**：桌面端固定 256px 侧栏，不可折叠。

**建议**：
- 添加图标-only 折叠模式（64px），悬停展开
- 给需要大屏看表格/报表的场景更多空间

#### 3.10 无面包屑

**现状**：用户不知道自己在哪个建筑/层级下。

**建议**：
- 在 `main` 顶部加面包屑（首页 > 账单 > 西山东区30号）
- 帮助用户定位和回退

#### 3.11 无键盘快捷键

**建议**：
- `⌘/Ctrl + K`：命令面板（跳转页面）
- `⌘/Ctrl + J`：主题切换（VS Code 用户熟悉）
- `Esc`：关闭模态框（迁移到 Radix 后自动获得）

#### 3.12 语言不一致

**现状**：混用繁体（賬期、讀數、噸）和简体（账单、状态）。

**建议**：
- 统一为简体（面向大陆房东）
- 或根据用户设置切换

---

## 4. 设计系统评估

### 4.1 已有资产（做得好的）

| 资产 | 状态 | 评价 |
|------|------|------|
| CSS Custom Properties | ✅ 完整 | HSL 格式，语义命名，light/dark 双主题 |
| shadcn 色彩体系 | ✅ 完整 | background/foreground/primary/secondary/destructive/muted/accent/popover/card/border/input/ring/sidebar |
| 语义色 | ✅ 完整 | success/warning/info + foreground 变体 |
| 图表色 | ✅ 完整 | chart-1 ~ chart-5 |
| 圆角系统 | ✅ 完整 | lg/md/sm 基于 `--radius` |
| 动画 | ✅ 完整 | accordion/fade-in/fade-up/slide-in-right |
| 暗色主题 | ✅ 完整 | `.dark` class + system 跟随 + 持久化 |
| 无障碍基础 | ✅ 有 | skip link、focus-visible、sr-only、prefers-reduced-motion、prefers-contrast、safe-area、44px touch target、print |
| Button 组件 | ✅ 完整 | 6 variant × 4 size，CVA |
| Card 组件 | ✅ 完整 | Header/Title/Description/Content/Footer |
| ThemeToggle | ⚠️ 有但需改进 | 循环按钮 → 分段控制器 |

### 4.2 缺失组件（需补齐）

| 组件 | 优先级 | Radix Primitive | 用途 |
|------|--------|-----------------|------|
| Select | 🔴 P0 | `@radix-ui/react-select` | 下拉选择（状态、建筑、账期） |
| Textarea | 🔴 P0 | 原生 + shadcn 样式 | 备注、说明 |
| Checkbox | 🔴 P0 | `@radix-ui/react-checkbox` | 多选、全选 |
| Dialog | 🔴 P0 | `@radix-ui/react-dialog` ✅ 已安装 | 所有模态框 |
| AlertDialog | 🔴 P0 | Dialog 变体 | 删除确认 |
| Toast | 🟡 P1 | `@radix-ui/react-toast` ✅ 已安装 | 操作反馈 |
| Dropdown Menu | 🟡 P1 | `@radix-ui/react-dropdown-menu` ✅ 已安装 | 操作菜单、批量操作 |
| Table | 🟡 P1 | 原生 + shadcn 样式 | 数据表格 |
| Tabs | 🟡 P1 | `@radix-ui/react-tabs` ✅ 已安装 | 设置页、详情页 |
| Tooltip | 🟢 P2 | `@radix-ui/react-tooltip` | 图标按钮说明 |
| Command | 🟢 P2 | `cmdk` | 命令面板 ⌘K |
| Breadcrumb | 🟢 P2 | 原生 + 样式 | 导航路径 |
| Skeleton | 🟢 P2 | 原生 + 样式 | 加载占位 |
| Empty State | 🟢 P2 | 原生 + 样式 | 空数据统一展示 |

---

## 5. 响应式策略审计

### 5.1 当前断点使用

| 断点 | 用途 | 评价 |
|------|------|------|
| `md` (768px) | Dashboard 卡片 2 列、Properties 卡片 2 列 | ✅ 合理 |
| `lg` (1024px) | 侧栏显示、Dashboard 4 列、Properties 3 列 | ✅ 合理 |

### 5.2 问题

| 问题 | 详情 |
|------|------|
| 表格无适配 | Records 10 列数据，手机端横向滚动 |
| 模态框无响应 | 固定 `max-w-2xl`，手机上占满屏但无安全区 |
| 表单栅格无响应 | `grid-cols-3` / `grid-cols-4` 在手机端仍 3/4 列，字段挤成一团 |
| 侧栏 overlay 无动画 | 突然出现/消失，无 slide-in |
| 无 safe-area 应用 | globals.css 定义了 `.safe-top`/`.safe-bottom` 但没在布局中使用 |

### 5.3 建议的响应式策略

```
Mobile First 基础：320px+
├── 单列布局
├── 表格 → 卡片视图
├── 模态框 → 全屏 sheet（底部弹出）
├── 表单 → 单列，全宽按钮
└── 侧栏 → overlay + 背景模糊

Tablet 增强：768px+
├── 2 列卡片
├── 表格 → 横向滚动 + 固定首列
├── 模态框 → 居中，max-w-lg
└── 表单 → 2 列栅格

Desktop 完整：1024px+
├── 侧栏 persistent
├── Dashboard 4 列
├── 表格 → 完整列
└── 表单 → 3-4 列栅格

大屏优化：1280px+
├── 内容区 max-width 约束
└── 表格列宽松
```

---

## 6. 无障碍审计

### 6.1 已有（做得好的）

| 项目 | 实现 |
|------|------|
| Skip to main content | ✅ `RootLayout` 顶部跳转链接 |
| Focus visible | ✅ `outline: 2px solid hsl(var(--ring))` |
| Screen reader only | ✅ `.sr-only` utility |
| 减少动画 | ✅ `prefers-reduced-motion` 全局禁用动画 |
| 高对比度 | ✅ `prefers-contrast: high` 加粗边框 |
| 触摸目标 | ✅ `pointer: coarse` 时 `min-height/width: 44px` |
| 语义化 landmark | ✅ `<aside role="navigation">` + `<main role="main">` |
| ARIA current | ✅ 当前页面 `aria-current="page"` |
| ARIA label | ✅ 图标按钮有 `aria-label` |

### 6.2 缺失（需补齐）

| 项目 | 现状 | 建议 |
|------|------|------|
| 模态框 ARIA | ❌ 无 role/aria-modal/aria-labelledby | 迁移到 Radix Dialog 自动获得 |
| 表单 label 关联 | ❌ 手写 input 无 `htmlFor`/`id` 关联 | 用 `FormField` 包装器强制关联 |
| 表单错误提示 | ❌ 无 `aria-invalid` / `aria-describedby` | 错误时设置 `aria-invalid="true"` |
| 动态内容通知 | ❌ 无 `aria-live` region | Toast 容器设 `aria-live="polite"` |
| 颜色对比度 | ⚠️ 未验证 | 用 axe-core 或 Lighthouse 跑一遍 |
| 键盘导航顺序 | ⚠️ 未测试 | Tab 顺序应从上到下、从左到右 |
| 焦点管理 | ❌ 模态框打开时焦点未移入 | Radix Dialog 自动处理 |

---

## 7. 推荐的架构改进

### 7.1 组件架构（shadcn 化）

```
src/components/
├── ui/                    # 基础组件（shadcn 风格）
│   ├── Button.tsx         ✅ 已有
│   ├── Card.tsx           ✅ 已有
│   ├── Input.tsx          ✅ 已有
│   ├── Badge.tsx          ✅ 已有
│   ├── Select.tsx         ❌ 需加
│   ├── Textarea.tsx       ❌ 需加
│   ├── Checkbox.tsx       ❌ 需加
│   ├── Dialog.tsx         ❌ 需加
│   ├── Toast.tsx          ❌ 需加
│   ├── DropdownMenu.tsx   ❌ 需加
│   ├── Table.tsx          ❌ 需加
│   ├── Skeleton.tsx       ❌ 需加
│   ├── EmptyState.tsx     ❌ 需加
│   └── Label.tsx          ❌ 需加
├── forms/                 # 表单包装器
│   ├── FormField.tsx      # label + control + error + hint
│   ├── FormItem.tsx
│   └── FormMessage.tsx
├── layout/                # 布局组件
│   ├── RootLayout.tsx     ✅ 已有
│   ├── Sidebar.tsx        ⚠️ 从 RootLayout 拆分
│   ├── Header.tsx         ⚠️ 从 RootLayout 拆分
│   └── Breadcrumb.tsx     ❌ 需加
├── theme/
│   ├── ThemeToggle.tsx    ⚠️ 改进为分段控制器
│   └── ThemeProvider.tsx  ❌ 需加（统一主题初始化）
└── data/                  # 数据展示
    ├── DataTable.tsx      # 通用表格（排序/筛选/分页）
    ├── StatCard.tsx       # Dashboard 统计卡
    └── ChartContainer.tsx # 图表主题包装
```

### 7.2 页面模板模式

每个列表页应遵循统一模式：

```tsx
// 标准列表页结构
<PageHeader
  title="账单管理"
  description="共 120 笔账单"
  actions={<Button>添加账单</Button>}
/>
<FilterBar>
  <SearchInput />
  <SelectFilter />
</FilterBar>
<DataTable
  columns={columns}
  data={data}
  emptyState={<EmptyState icon={Receipt} title="暂无账单" />}
  loading={<SkeletonRows count={5} />}
/>
<Pagination />
```

### 7.3 模态框模式

```tsx
// 标准编辑模态框
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>编辑房源</DialogTitle>
      <DialogDescription>修改房源信息</DialogDescription>
    </DialogHeader>
    <Form>
      {/* fields */}
    </Form>
    <DialogFooter>
      <Button variant="outline" onClick={onClose}>取消</Button>
      <Button type="submit">保存</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 8. 实施路线图

### Phase 1：补齐基础组件（1-2 天）

目标：消除表单控件不一致和模态框无障碍问题。

| 任务 | 文件 | 依赖 |
|------|------|------|
| 安装 shadcn Select | `components/ui/Select.tsx` | `@radix-ui/react-select` |
| 安装 shadcn Textarea | `components/ui/Textarea.tsx` | 无 |
| 安装 shadcn Checkbox | `components/ui/Checkbox.tsx` | `@radix-ui/react-checkbox` |
| 安装 shadcn Dialog | `components/ui/Dialog.tsx` | 已有 |
| 安装 shadcn Label | `components/ui/Label.tsx` | 已有 |
| 创建 FormField 包装器 | `components/forms/FormField.tsx` | 以上组件 |

### Phase 2：迁移现有页面（2-3 天）

| 任务 | 页面 | 工作量 |
|------|------|--------|
| Properties 页面表单迁移 | Properties.tsx | 中 |
| Records 页面表单迁移 | Records.tsx | 大（3 个模态框） |
| 所有 `confirm()` → AlertDialog | 全局 | 小 |
| 所有 `prompt()` → Dialog | Records 微信发送 | 小 |
| 所有 `alert()` → Toast | 全局 | 小 |

### Phase 3：反馈系统 + 主题改进（1 天）

| 任务 | 详情 |
|------|------|
| 安装 shadcn Toast | `components/ui/Toast.tsx` |
| 封装 `useToast` hook | 全局 mutation 自动触发 |
| ThemeToggle → 分段控制器 | 显示 3 个选项 |
| 图表颜色改用 CSS 变量 | Dashboard `COLORS` → `hsl(var(--chart-N))` |

### Phase 4：信息架构重组（1-2 天）

| 任务 | 详情 |
|------|------|
| 侧栏分组（Section header） | 租务/财务/抄表/沟通 |
| 二级菜单折叠 | 点击展开子项 |
| 面包屑组件 | `components/layout/Breadcrumb.tsx` |
| 命令面板（可选） | ⌘K 跳转 |

### Phase 5：响应式 + 无障碍打磨（1-2 天）

| 任务 | 详情 |
|------|------|
| 表格 → 卡片视图切换 | Records/Payments/Expenses |
| 模态框手机端 sheet 动画 | Dialog `slide-in-bottom` |
| 表单栅格响应式 | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| safe-area 应用 | Header/Footer 加 `.safe-top`/`.safe-bottom` |
| Lighthouse 跑分 | 目标：Accessibility ≥ 90 |

---

## 9. 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 表单控件一致性 | ~60%（混用原生/shadcn） | 100% shadcn |
| 模态框无障碍 | 0%（全手写） | 100% Radix Dialog |
| Toast 反馈覆盖 | 0% | 100% mutation |
| Lighthouse Accessibility | 未测 | ≥ 90 |
| 一级导航项 | 18 | 7 |
| 图表暗色适配 | 硬编码 | CSS 变量 |

---

## 10. 附录：文件清单

### 已审计文件

| 文件 | 行数 | 作用 |
|------|------|------|
| `src/routes/layouts/RootLayout.tsx` | 207 | 主布局（侧栏 + 顶栏 + 移动侧栏） |
| `src/routes/index.tsx` | 171 | 路由定义（18 条） |
| `src/styles/globals.css` | 202 | 设计 Token + 全局样式 |
| `src/stores/theme.ts` | 72 | 主题状态管理 |
| `src/stores/auth.ts` | 59 | 认证状态管理 |
| `src/components/ThemeToggle.tsx` | 42 | 主题切换按钮 |
| `src/components/ui/Button.tsx` | 47 | 按钮组件 |
| `src/components/ui/Card.tsx` | 51 | 卡片组件 |
| `src/pages/Dashboard.tsx` | 239 | 仪表盘（图表 + 统计） |
| `src/pages/Properties.tsx` | 608 | 房源管理（卡片 + 编辑模态框） |
| `src/pages/Records.tsx` | 1160 | 账单管理（表格 + 3 模态框） |
| `src/pages/Login.tsx` | 83 | 登录页 |
| `src/lib/api.ts` | 379 | API 客户端（14 个 API 模块） |
| `tailwind.config.js` | 112 | Tailwind 配置 |

### 未审计但推断存在的页面

Tenants、Contracts、Payments、Transactions、Expenses、WorkOrders、MeterInputPage、UtilityBills、MeterDrafts、MessageLogs、Receipts、Reminders、Reports、Settings、WeChatBot

---

**审计完成。下一步建议**：先做 Phase 1（补齐 Select/Textarea/Checkbox/Dialog 组件），这是后续所有迁移的基础。需要我直接生成这些组件的代码吗？
