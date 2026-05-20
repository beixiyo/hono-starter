// 如果你需要加载环境变量，请下载 @jl-org/tool 包，并使用 loadEnv 函数
// import { loadEnv } from '@jl-org/tool/node'
import { resolve } from 'node:path'
import type { Config } from 'drizzle-kit'

// loadEnv({
//   envPath: resolve(__dirname, './env/.env.development')
// })

export const PG_USER = process.env.POSTGRES_USER ?? 'my_user'
export const PG_PASSWORD = process.env.POSTGRES_PASSWORD ?? 'my_password'
export const PG_DATABASE = process.env.POSTGRES_DB ?? 'my_database'
export const PG_HOST = process.env.POSTGRES_HOST ?? 'localhost'
export const PG_PORT = process.env.POSTGRES_PORT ?? '5432'
export const PG_URL = process.env.DATABASE_URL ?? `postgres://${encodeURIComponent(PG_USER)}:${encodeURIComponent(PG_PASSWORD)}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`

/**
 * Drizzle CLI 配置（PostgreSQL）
 *
 * 常用命令：
 *   - bun x drizzle-kit push: 快速同步，直接执行变更 SQL，适用于单人开发。NOTE: 它会删除你没定义的 schema
 *   - bun x drizzle-kit generate: 生成迁移 SQL 文件
 *   - bun x drizzle-kit migrate:  执行迁移
 */
export default {
  schema: './src/db/schema/dashboard/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: PG_URL,
  },
} satisfies Config
