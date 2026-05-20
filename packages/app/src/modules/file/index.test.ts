import { describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { JWT_CONFIG, TEST_CONFIG } from '@/core'
import { startApp } from '../../index'

const { app } = await startApp()

describe('文件模块功能测试', () => {
  test('文件上传功能测试', async () => {
    const formData = new FormData()
    const file = new File(['test content'], 'test-upload.txt', { type: 'text/plain' })
    formData.append('file', file)

    const token = await sign(
      { sub: 'user123', exp: Math.floor(Date.now() / 1000) + 60 },
      JWT_CONFIG.secret,
      'HS256',
    )
    const res = await app.request('/api/file/upload', {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: TEST_CONFIG.origin,
      },
    })

    expect(res.status).toBe(200)
    const data = res.status === 200
      ? await res.json()
      : {}
    expect(data.success).toBe(true)
    expect(data.data.message).toBe('文件上传成功')
    expect(data.data.url).toBe('/uploads/test-upload.txt')
  })
})
