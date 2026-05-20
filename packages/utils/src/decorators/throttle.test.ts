import { describe, expect, test } from 'bun:test'
import { Throttle } from './throttle'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

describe('Throttle', () => {
  test('should limit async calls within interval and reuse pending result', async () => {
    class Service {
      public count = 0

      @Throttle(30)
      async work(value: number) {
        this.count++
        await sleep(5)
        return value
      }
    }

    const s = new Service()

    const p1 = s.work(1)
    const p2 = s.work(2)

    const [r1, r2] = await Promise.all([p1, p2])

    expect(s.count).toBe(1)
    expect(r1).toBe(1)
    expect(r2).toBe(1)

    await sleep(40)

    const r3 = await s.work(3)
    expect(s.count).toBe(2)
    expect(r3).toBe(3)
  })

  test('should handle sync functions correctly', async () => {
    class SyncService {
      public count = 0

      @Throttle(30)
      getValue() {
        this.count++
        return 42
      }
    }

    const s = new SyncService()

    // 首次调用，正常返回
    const r1 = s.getValue()
    expect(r1).toBe(42)
    expect(s.count).toBe(1)

    // 冷却期内，返回 undefined
    const r2 = s.getValue()
    expect(r2).toBeUndefined()
    expect(s.count).toBe(1)

    // 等待冷却期结束
    await sleep(40)

    // 冷却期后，正常返回
    const r3 = s.getValue()
    expect(r3).toBe(42)
    expect(s.count).toBe(2)
  })
})
