import { describe, expect, test } from 'bun:test'
import { isDev, isProd } from './index'

describe('env', () => {
  test('isDev and isProd should work correctly', () => {
    // 在测试环境中，NODE_ENV 默认是 'test'
    // 这两个函数互斥
    expect(isDev() || isProd()).toBe(false)
  })
})
