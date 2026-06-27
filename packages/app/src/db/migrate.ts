/**
 * PostgreSQL 迁移：在应用启动时执行 drizzle 生成的 SQL 迁移
 * 使用 drizzle-orm/node-postgres/migrator，无需 drizzle-kit
 *
 * 环境变量 MIGRATE_DATABASE_ON_STARTUP：
 *   - 默认 true：每次启动执行迁移
 *   - "false" | "0"：跳过迁移（适用于迁移在 CI/部署脚本中单独执行的场景）
 */
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { logger } from '@/core/logger'

function isMigrateEnabled(): boolean {
  const v = process.env.MIGRATE_DATABASE_ON_STARTUP
  if (v === 'false' || v === '0')
    return false
  return true
}

function getPgUrl(): string {
  const url = process.env.DATABASE_URL
  if (url)
    return url

  const user = process.env.POSTGRES_USER ?? 'postgres'
  const password = process.env.POSTGRES_PASSWORD ?? ''
  const host = process.env.POSTGRES_HOST ?? 'localhost'
  const port = process.env.POSTGRES_PORT ?? '5432'
  const database = process.env.POSTGRES_DB ?? 'flowtica_server'

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

/**
 * 执行 PostgreSQL 迁移
 * migrationsFolder 默认为运行目录下的 drizzle（部署时与 index.js 同级）
 */
export async function runPgMigrations(migrationsFolder?: string): Promise<void> {
  if (!isMigrateEnabled()) {
    logger.info('MIGRATE_DATABASE_ON_STARTUP=false，跳过 PostgreSQL 迁移')
    return
  }

  const folder = migrationsFolder ?? join(process.cwd(), 'drizzle')

  try {
    const url = getPgUrl()
    const pool = new Pool({
      connectionString: url,
      /** PG_SSL=true 时启用 SSL（不验证证书，适用于内网自签证书）；dev 默认不加 SSL */
      ssl: process.env.PG_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    })
    const db = drizzle({ client: pool })

    await migrate(db, { migrationsFolder: folder })
    await pool.end()

    logger.info('PostgreSQL 迁移完成')
  }
  catch (err) {
    logger.error('PostgreSQL 迁移失败', err)
    throw err
  }
}
