import type { Token } from 'di'
import { SQL } from 'bun'
import { Database } from 'bun:sqlite'
import { drizzle as drizzleBunSql } from 'drizzle-orm/bun-sql'
import { drizzle as drizzleSqlite } from 'drizzle-orm/bun-sqlite'
import { PG_URL } from '../../drizzle.config'

/**
 * @description
 * Drizzle ORM 客户端（双配置：PostgreSQL / SQLite）
 */

export type PgDb = ReturnType<typeof drizzleBunSql>
export type SqliteDb = ReturnType<typeof drizzleSqlite>
export const PgDbToken: Token<PgDb> = Symbol('PgDb')
export const SqliteDbToken: Token<SqliteDb> = Symbol('SqliteDb')

export { PG_URL }

/**
 * 创建 PostgreSQL 版本 Db（Bun SQL + drizzle-orm/bun-sql）
 */
export function createPgDb(): PgDb {
  if (!PG_URL)
    throw new Error('DATABASE_URL is not set (for PostgreSQL via Bun SQL)')

  const pgClient = new SQL({
    url: PG_URL,
    tls: process.env.PG_SSL === 'true',
  })
  return drizzleBunSql({ client: pgClient })
}

/**
 * 创建 SQLite 版本 Db（bun:sqlite + drizzle-orm/bun-sqlite）
 */
export function createSqliteDb(): SqliteDb {
  const sqlite = new Database('db.sqlite')
  return drizzleSqlite(sqlite)
}
