import {
  index,
  integer,
  numeric,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { jsonb } from '../columns'
import { dashboard } from './constants'

/**
 * 用户表 (dashboard.users)
 * 存放用户核心业务资料、会员身份及资源余额
 */
export const users = dashboard.table(
  'users',
  {
    /** 用户唯一标识 */
    id: uuid('id').defaultRandom().primaryKey(),

    /** 用户邮箱，全局唯一标识 */
    email: varchar('email', { length: 255 }).notNull().unique(),

    /** 用户昵称 */
    name: text('name'),

    /** 用户头像地址 */
    avatarUrl: text('avatar_url'),

    // --- 会员权益 ---

    /** 当前会员等级: free(免费), pro(专业), enterprise(企业) */
    currentTier: varchar('current_tier', { length: 50 }).notNull().default('free'),

    /** 会员权益到期时间，为 NULL 表示永不过期或未开通 */
    tierExpiredAt: timestamp('tier_expired_at', { withTimezone: true }),

    // --- 资源余额 ---

    /**
     * 转录时长余额(分钟)，支持两位小数以确保秒级精度
     * 使用 numeric 避免浮点数计算误差
     */
    transcriptionMinutesBalance: numeric('transcription_minutes_balance', {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default('0'),

    /** AI 额度余额，通常为整数点数 */
    aiQuotaBalance: integer('ai_quota_balance').notNull().default(0),

    // --- 元数据与安全 ---

    /** 用户已绑定的设备 ID 数组 (JSONB 格式) */
    deviceIds: jsonb('device_ids').default([]),

    /** 最后一次登录系统的记录时间 */
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),

    /** 账号创建时间 */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** 记录最后修改时间 */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('users_email_idx').on(table.email),
    index('users_tier_idx').on(table.currentTier),
  ],
)
