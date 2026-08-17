# 🏠 收租佬系统 V5.0

> **个人房东租赁管理系统** — 现代化、高性能、类型安全

![Version](https://img.shields.io/badge/version-5.0.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-green)
![React](https://img.shields.io/badge/React-18.3-blue)
![Hono](https://img.shields.io/badge/Hono-4-orange)

## ✨ 特性

- 🎨 **现代化 UI** — Tailwind CSS + 自定义设计系统，深色模式支持
- ⚡ **极致性能** — 代码分割、虚拟化列表、乐观更新
- 📱 **移动优先** — 响应式布局，触屏友好的交互
- 🔐 **安全可靠** — JWT 认证、RBAC 权限控制、bcrypt 加密
- 💾 **数据本地** — SQLite + WAL 模式，无需外部数据库
- 🔄 **离线优先** — Service Worker + PWA 支持
- ♿ **无障碍** — WCAG 2.1 AA 合规

## 🏗️ 技术栈

### 前端
- React 18.3 + TypeScript
- TanStack Router (类型安全路由)
- TanStack Query (数据获取)
- Zustand (状态管理)
- Tailwind CSS + CSS Variables (设计系统)
- Framer Motion (动画)
- Vite 5 (构建工具)

### 后端
- Node.js 22 + TypeScript
- Hono 4 (轻量快速的 Web 框架)
- Drizzle ORM (类型安全 SQL)
- better-sqlite3 (原生 SQLite)
- Zod (运行时验证)
- jose (JWT)
- bcryptjs (密码加密)

### 基础设施
- Docker + Docker Compose
- pnpm (Monorepo 管理)
- Turborepo (构建缓存)

## 📁 项目结构

```
income-rent-v5/
├── apps/
│   ├── web/              # 前端 React 应用
│   └── api/              # 后端 Hono API
├── packages/
│   └── shared/           # 共享类型、Schema、常量
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

## 🚀 快速开始

### 前置要求
- Node.js 20+
- pnpm 9+

### 安装

```bash
# 安装 pnpm
npm install -g pnpm

# 克隆项目
git clone https://github.com/your-repo/income-rent-v5.git
cd income-rent-v5

# 安装依赖
pnpm install
```

### 开发

```bash
# 启动所有服务（前端 + 后端）
pnpm dev

# 或者分别启动
pnpm dev:api    # 后端: http://localhost:8788
pnpm dev:web    # 前端: http://localhost:5173
```

### 数据库

```bash
# 生成数据库迁移
pnpm db:generate

# 运行迁移
pnpm db:migrate

# 填充示例数据
pnpm db:seed
```

### 构建

```bash
pnpm build
```

### Docker 部署

```bash
# 复制环境变量
cp .env.example .env
# 编辑 .env 配置

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f api
```

## 📖 API 文档

启动后端后，访问: `http://localhost:8788/api/health`

### 主要端点

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/login | 登录 |
| POST | /api/auth/logout | 退出 |
| GET | /api/auth/me | 当前用户 |
| GET | /api/properties | 房源列表 |
| POST | /api/properties | 创建房源 |
| GET | /api/tenants | 租客列表 |
| POST | /api/tenants | 创建租客 |
| GET | /api/records | 账单列表 |
| POST | /api/records | 创建账单 |
| GET | /api/dashboard | 仪表板统计 |

## 🔑 默认账户

首次启动后自动创建：
- 用户名: `admin`
- 密码: `changeme`

⚠️ **请在首次登录后立即修改密码！**

## 🛠️ 开发指南

### 代码规范
- ESLint + TypeScript 严格模式
- 所有 API 使用 Zod 验证
- 组件使用 TypeScript 接口定义 Props

### 添加新功能
1. 在 `packages/shared/src/schemas/` 定义 Zod Schema
2. 在 `apps/api/src/routes/` 创建路由
3. 在 `apps/web/src/features/` 创建页面组件
4. 在 `apps/web/src/routes/index.tsx` 注册路由

## 📄 License

MIT

---

**前端开发者 Agent** | 2026-08-14
