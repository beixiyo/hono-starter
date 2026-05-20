import type { Container } from 'di'
import type { PgDb } from '@/db/client'
import { SQL } from 'bun'
import { drizzle as drizzleBunSql } from 'drizzle-orm/bun-sql'
import { PG_URL } from '@/db/client'
import { startApp } from '@/index'
import { createContainer } from '@/register'

const hasDbEnv = !!(process.env.DATABASE_URL || process.env.POSTGRES_HOST)

/**
 * 在单个数据库事务中执行测试逻辑，结束后自动回滚，不污染真实数据。
 *
 * - 使用 createContainer({ pgDb }) 注入事务内 Drizzle，保证所有 Service 正常解析
 * - 包装 db.transaction 为直通执行，避免嵌套 BEGIN 报错
 * - fn 内可从 container 获取完整 app，所有 Postgres 操作均在事务内，结束时回滚
 */
export async function withDbTransaction<T>(
  fn: (ctx: TestContainerContext) => Promise<T>,
): Promise<T> {
  if (!hasDbEnv)
    throw new Error('DATABASE_URL is not set (for PostgreSQL via Bun SQL)')

  const sql = new SQL(PG_URL)
  let result!: T

  try {
    await sql.begin(async (txSql) => {
      const txDb = drizzleBunSql({ client: txSql })
      const wrappedDb = wrapTransactionalDb(txDb)
      const container = createContainer({ pgDb: wrappedDb })

      result = await fn({ container })

      /** 使用特殊错误强制回滚事务，外层捕获后忽略 */
      throw new Error('__ROLLBACK_FOR_TEST__')
    })
  }
  catch (error) {
    if (error instanceof Error && error.message === '__ROLLBACK_FOR_TEST__')
      return result

    throw error
  }

  return result
}

/**
 * 使用指定 container 创建测试用 Hono 应用
 * 需在调用前执行 loadModules()
 */
export const createTestApp = startApp

export interface TestContainerContext {
  container: Container
}

/**
 * 包装已在事务中的 Drizzle 实例，使 db.transaction(fn) 直接执行 fn(txDb) 而不再发起嵌套 BEGIN。
 * 解决 "cannot call begin inside a transaction" 报错。
 */
function wrapTransactionalDb(txDb: PgDb): PgDb {
  return new Proxy(txDb, {
    get(target, prop) {
      if (prop === 'transaction')
        return (fn: (tx: PgDb) => Promise<unknown>) => fn(target)
      return Reflect.get(target, prop)
    },
  }) as PgDb
}
