import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/**
 * 管理员 Refresh Token 表 (public.admin_refresh_tokens)
 *
 * 双 Token 机制：Access Token 短命（15min），Refresh Token 长命（7d）。
 * 每次刷新执行旋转（rotation）：旧 Token 吊销 + 颁发新 Token。
 * 若检测到已吊销 Token 被复用，说明 Token 泄露，吊销该账号所有 Refresh Token。
 */
export const adminRefreshTokens = pgTable(
  'admin_refresh_tokens',
  {
    /** 记录 ID */
    id: uuid('id').defaultRandom().primaryKey(),

    /** 关联的管理员账号 ID */
    accountId: uuid('account_id').notNull(),

    /** Refresh Token 的 SHA-256 哈希（不存明文） */
    tokenHash: text('token_hash').notNull(),

    /** 过期时间 */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    /** 创建时间 */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** 吊销时间（非空表示已吊销） */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),

    /** 旋转时指向替代 Token 的 ID，用于复用检测 */
    replacedBy: uuid('replaced_by'),
  },
  table => [
    index('idx_refresh_token_hash').on(table.tokenHash),
    index('idx_refresh_account').on(table.accountId),
  ],
)
