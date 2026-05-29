import { customType } from 'drizzle-orm/pg-core'

/**
 * @file 自定义 Drizzle 列类型
 */

/**
 * `jsonb` 列（**替代 drizzle 内置的 `jsonb`，请勿再从 `drizzle-orm/pg-core` 引入 jsonb**）
 *
 * 背景：drizzle 内置 `jsonb` 的 `mapToDriverValue` 会先 `JSON.stringify` 一次，
 * 而 Bun 原生 SQL 驱动（`drizzle-orm/bun-sql`）在绑定 jsonb 参数时**又会序列化一次**，
 * 导致**双重编码**——对象/数组被存成 JSON 字符串标量（`jsonb_typeof = 'string'`），
 * 使所有 jsonb 操作符（`@>`、`->`、`->>`、`-` 等）静默失效，且读取因 drizzle 兜底
 * `JSON.parse` 暂时正常而极其隐蔽。这是 drizzle-orm + bun-sql 的已知上游 bug
 * （drizzle-team/drizzle-orm#4942、#5139），升级到 v1 beta 仍复现，故用自定义类型规避。
 *
 * 解决：
 * - **写入**不做 `JSON.stringify`（`toDriver` 原样透传），交给 Bun SQL 原生序列化，只编码一次。
 * - **读取**对历史「双重编码」行（字符串标量）做兜底 `JSON.parse`，保证数据归一化迁移
 *   完成前的读取不报错；正常 jsonb 行 Bun 已返回解析后的值，直接透传。
 *
 * 注意：本类型假定列存的是对象/数组/Record。若某列需要存「JSON 字符串标量」（如 `"1"`），
 * 兜底 `JSON.parse` 会把它读成对应原始值，此场景请勿用本类型。
 *
 * @example
 * deviceIds: jsonb<string[]>('device_ids').default([])
 */
export function jsonb<TData>(name: string) {
  return customType<{ data: TData, driverData: unknown }>({
    dataType: () => 'jsonb',

    /** 不 JSON.stringify，交给 Bun SQL 原生序列化（只编码一次） */
    toDriver: value => value,

    // Bun 对正常 jsonb 返回已解析的值；仅历史双重编码行会是字符串，兜底 parse
    fromDriver: (value) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as TData
        }
        catch {
          return value as unknown as TData
        }
      }

      return value as TData
    },
  })(name)
}
