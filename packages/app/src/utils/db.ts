import type { SQL } from 'drizzle-orm'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type { PgDb } from '@/db/client'
import { and, count } from 'drizzle-orm'

/**
 * 构建动态查询条件
 * @description 接收 [条件, 回调函数] 的数组，仅当条件为真时执行回调并包含返回的 SQL 表达式
 * @example
 * buildWhere(
 *   [status, () => eq(table.status, status!)],
 *   [batchId, () => eq(table.batchId, batchId!)]
 * )
 */
export function buildWhere(...conditions: WhereCondition[]): SQL | undefined {
  const filtered = conditions
    .filter(([cond, sql]) => !!cond && !!sql)
    .map(([_, sql]) => sql as SQL)

  return filtered.length > 0
    ? and(...filtered)
    : undefined
}

/**
 * 分页参数计算
 * @description 统一将 page/pageSize 转换为 limit/offset，带默认值和下限保护
 */
export function buildPagination(input: PageQuery) {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.max(1, input.pageSize ?? 10)

  const limit = pageSize
  const offset = (page - 1) * pageSize

  return {
    page,
    pageSize,
    limit,
    offset,
  }
}

/**
 * 分页 + 条件查询组合工具
 * @description
 * - 同时返回分页参数（page/pageSize/limit/offset）和 where 条件
 * - 适合大部分「列表 + 筛选」场景
 */
export function buildListQueryOptions(
  input: PageQuery,
  ...conditions: WhereCondition[]
) {
  const pagination = buildPagination(input)
  const where = buildWhere(...conditions)

  return {
    ...pagination,
    where,
  }
}

/**
 * 通用计数工具
 * @description 传入配置对象（db / from / where），返回总数
 */
export async function getDbCount(options: {
  db: PgDb
  from: PgTableWithColumns<any>
  where?: SQL | undefined
}): Promise<number> {
  const { db, from, where } = options

  const [{ total }] = await db
    .select({ total: count() })
    .from(from)
    .where(where)

  return total
}

export type PageQuery = {
  page?: number
  pageSize?: number
}

export type WhereCondition = [
  boolean | undefined | null | string,
  SQL | undefined | null | string,
]
