import { describe, expect, it } from 'bun:test'
import { sign } from 'hono/jwt'
import { JWT_CONFIG } from '@/core/constants'
import { startApp } from '../../index'

const { app } = await startApp()

describe('SSE Module', () => {
  it('should return 200 and event-stream content type', async () => {
    const token = await sign({ sub: 'user123', exp: Math.floor(Date.now() / 1000) + 60 }, JWT_CONFIG.secret, 'HS256')
    const res = await app.request('/api/sse/events', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    /** 读取第一条数据验证 */
    const reader = res.body?.getReader()
    if (reader) {
      const { value } = await reader.read()
      const text = new TextDecoder().decode(value)
      expect(text).toContain('event: time-update')
      reader.releaseLock()
    }
  })
})
