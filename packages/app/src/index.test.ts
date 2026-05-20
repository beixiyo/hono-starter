import type { User } from './modules/user/schema'
import type { UserService } from './modules/user/service'
import { describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { JWT_CONFIG } from './core/constants'
import { PgDbToken } from './db/client'
import { startApp } from './index'
import { UserServiceToken } from './modules/user/tokens'

/**
 * 创建测试用的应用实例（统一走 startApp），并在 createApp 前覆写 UserService
 */
async function createTestApp() {
  return startApp({
    async beforeCreateApp(container) {
      const db = container.resolve(PgDbToken)

      // @ts-ignore
      const mockUserService: UserService = {
        db,
        async getUserById(id: string): Promise<User> {
          /** 模拟数据库查询，直接返回测试数据 */
          return {
            id,
            name: 'Ultra-man',
            age: 20,
          }
        },
        /** 其他方法可以按需实现或留空 */
        async listUsers() { return [] },
        async createUser() { throw new Error('Not implemented in mock') },
        async updateUser() { return null },
        async deleteUser() { return false },
        async listUsersWithPosts() { return [] },
        async listUsersWhoHavePosts() { return [] },
      }

      /** 用 mock 覆盖真实的 UserService */
      container.register({ token: UserServiceToken, useValue: mockUserService })
    },
  })
}

const { app: testApp } = await createTestApp()
const { app: testAppForParams } = await createTestApp()

describe('应用全局功能测试', () => {
  // 1. 静态资源测试
  test('应该能访问静态文件', async () => {
    const res = await testApp.request('/hello.txt')
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain('Hello from public')
  })

  // 2. OpenAPI 业务路由测试（使用 mock）
  test('应该能访问 User 业务路由', async () => {
    const token = await sign({ sub: 'user123', exp: Math.floor(Date.now() / 1000) + 60 }, JWT_CONFIG.secret, 'HS256')
    const res = await testApp.request('/api/users/123', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('123')
    expect(data.data.name).toBe('Ultra-man')
  })

  test('未登录访问受保护路由应返回 401', async () => {
    const res = await testApp.request('/api/users/123')
    expect(res.status).toBe(401)
  })
})

describe('User 参数注入 @Params 与 schema 校验', () => {
  async function getToken() {
    return sign(
      { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 60 },
      JWT_CONFIG.secret,
      'HS256',
    )
  }

  test('合法 id（≥3 字符）应 200，且 @Params("id") 注入的 id 被正确使用', async () => {
    const token = await getToken()
    const res = await testAppForParams.request('/api/users/123', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('123')
  })

  test('schema 校验：id 长度不足（ParamsSchema.min(3)）应返回 400', async () => {
    const token = await getToken()
    const res = await testAppForParams.request('/api/users/12', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(400)
  })
})
