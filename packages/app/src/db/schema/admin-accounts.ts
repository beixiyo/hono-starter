import type { AccountPermissions } from '@/rbac/types'
import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * 管理员账号表 (admin_accounts)
 *
 * 与 Postgres 版的 `admin_refresh_tokens` 分属不同存储：
 * 账号与权限使用 SQLite 以方便本地测试；Refresh Token 仍走 Postgres。
 *
 * 权限模型：每个账号独立携带一份 `permissions` JSON（资源 ID → 权限级别），
 * 运营可在后台直接调整，无需重新部署。
 */
export const adminAccounts = sqliteTable(
  'admin_accounts',
  {
    /** 账号唯一标识（UUID 或任意字符串主键） */
    id: text('id').primaryKey(),

    /** 登录邮箱，全局唯一 */
    email: text('email').notNull().unique(),

    /** 登录密码的 bcrypt/argon2 哈希；本模块不直接校验，由业务层 verifyAdminPassword */
    passwordHash: text('password_hash').notNull(),

    /**
     * 账号状态
     * - `active`：正常使用
     * - `disabled`：禁用，所有鉴权接口返回 401
     */
    status: text('status', { enum: ['active', 'disabled'] }).notNull().default('active'),

    /**
     * 账号权限映射：资源 ID → 权限级别
     * SQLite 无原生 JSONB，此处以 JSON 文本存储（drizzle `mode: 'json'` 自动序列化）
     */
    permissions: text('permissions', { mode: 'json' })
      .$type<AccountPermissions>()
      .notNull()
      .default(sql`'{}'`),

    /** 账号创建时间（Unix 毫秒） */
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),

    /** 最后更新时间（Unix 毫秒） */
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  table => [
    index('admin_accounts_email_idx').on(table.email),
    index('admin_accounts_status_idx').on(table.status),
  ],
)
