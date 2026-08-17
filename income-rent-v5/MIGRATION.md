# V5 迁移指南 (从 V4)

本文档说明如何将 V4 数据迁移到 V5。

## 准备工作

1. 备份 V4 数据库文件: `backend/storage/rental.db`
2. 导出 V4 数据为 JSON (如果需要)

## 自动迁移

V5 首次启动时会自动创建新的数据库结构。

## 手动迁移

如果需要从 V4 的 JSON 格式迁移到 V5 的 SQLite:

```bash
# 运行迁移脚本
pnpm --filter api migrate:v4
```

## 字段映射

| V4 字段 | V5 字段 | 说明 |
|---------|---------|------|
| `id` | `id` | 保持不变 |
| `createdAt` (ISO string) | `created_at` (timestamp) | 自动转换 |
| `tenantId` | `tenant_id` | 蛇形命名 |
| `roomLabel` | `room_label` | 蛇形命名 |

## 注意事项

1. V4 使用 sql.js (WASM)，V5 使用 better-sqlite3 (原生)
2. V5 增加了用户认证系统
3. V5 使用 UUID 而非自增 ID
