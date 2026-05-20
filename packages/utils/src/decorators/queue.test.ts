import { describe, expect, test } from 'bun:test'
import { Queue } from './queue'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

describe('Queue', () => {
  test('should serialize method calls', async () => {
    const order: number[] = []

    class Worker {
      @Queue()
      async job(id: number, delayMs: number) {
        order.push(id)
        await sleep(delayMs)
        return id
      }
    }

    const w = new Worker()
    const start = Date.now()

    const p1 = w.job(1, 30)
    const p2 = w.job(2, 10)

    const [r1, r2] = await Promise.all([p1, p2])
    const elapsed = Date.now() - start

    expect(r1).toBe(1)
    expect(r2).toBe(2)
    expect(order).toEqual([1, 2])
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })
})
