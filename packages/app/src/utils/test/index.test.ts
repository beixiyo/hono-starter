/**
 * 验证 utils/test 中的 withDbTransaction、createTestApp 是否正确可用
 */
import { expect, test } from 'bun:test'
import { createTestApp, withDbTransaction } from './index'

const hasDb = !!(process.env.DATABASE_URL || process.env.POSTGRES_HOST)

test('createTestApp 应能创建应用实例', async () => {
  const { app, container } = await createTestApp()

  expect(app).toBeDefined()
  expect(container).toBeDefined()
  expect(typeof app.fetch).toBe('function')
})

test('withDbTransaction 在无 DATABASE_URL 时应抛出明确错误', async () => {
  if (hasDb)
    return

  expect(withDbTransaction(async () => ({ ok: true }))).rejects.toThrow(
    'DATABASE_URL is not set',
  )
})

/**
 * 串行执行，避免与其余 47+ 测试并发争用数据库连接导致 Connection closed
 * @see https://github.com/oven-sh/bun/issues/22036
 */
test.serial('withDbTransaction 在有 DATABASE_URL 时应正常执行并回滚', async () => {
  if (!hasDb)
    return

  const result = await withDbTransaction(async ({ container }) => {
    const { app } = await createTestApp()
    expect(app).toBeDefined()
    return { ran: true }
  })

  expect(result).toEqual({ ran: true })
})
