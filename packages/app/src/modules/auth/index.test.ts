import { describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { JWT_CONFIG, TEST_CONFIG } from '@/core'
import { startApp } from '../../index'

const { app } = await startApp()

describe('认证模块功能测试', () => {
  /**
   * 登录接口需要 DB（RefreshTokenService），测试环境无 DB，
   * 直接签发 token 验证 JWT 保护逻辑
   */
  test('JWT 流程测试: 使用有效 token 访问受保护接口', async () => {
    const token = await sign(
      {
        sub: 'test-user',
        email: 'test@test.com',
        status: 'active',
        exp: Math.floor(Date.now() / 1000) + JWT_CONFIG.accessExpSeconds,
      },
      JWT_CONFIG.secret,
      'HS256',
    )

    const protectedRes = await app.request('/api/auth/jwt/protected', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(protectedRes.status).toBe(200)
    const data = await protectedRes.json()
    expect(data.success).toBe(true)
    expect(data.data.message).toBe('通过 JWT 验证')
  })

  test('JWT 异常测试: 错误或缺失 token 应该返回 401', async () => {
    const res1 = await app.request('/api/auth/jwt/protected')
    expect(res1.status).toBe(401)

    const res2 = await app.request('/api/auth/jwt/protected', {
      headers: {
        Authorization: 'Bearer invalid-token',
        Origin: TEST_CONFIG.origin,
      },
    })
    expect(res2.status).toBe(401)
  })

  test('JWT 过期测试: 过期的 token 应该返回 401', async () => {
    const payload = {
      sub: 'user123',
      exp: Math.floor(Date.now() / 1000) - 10, // 10秒前过期
    }
    const expiredToken = await sign(payload, JWT_CONFIG.secret, 'HS256')

    const res = await app.request('/api/auth/jwt/protected', {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    })
    expect(res.status).toBe(401)
  })

  test('登录接口公开路径不需要 token', async () => {
    const res = await app.request('/api/auth/jwt/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': TEST_CONFIG.origin,
      },
      body: JSON.stringify({ email: 'test@test.com', password: 'test' }),
    })
    /** 无 DB 会 500，但不应该是 401（说明公开路径生效） */
    expect(res.status).not.toBe(401)
  })
})
