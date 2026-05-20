import { describe, expect, test } from 'bun:test'
import { Batch } from './batch'

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

describe('Batch', () => {
  test('should flush by size and distribute per-item results', async () => {
    const calls: number[][] = []

    class Service {
      work(item: number): Promise<number>
      work(items: number[]): Promise<number[]>

      @Batch({ size: 3, timeoutMs: 1000, resultMode: 'perItem' })
      async work(items: number[] | number): Promise<number[] | number> {
        const batch = Array.isArray(items)
          ? items
          : [items]
        calls.push(batch)
        return batch.map(x => x * 2)
      }
    }

    const s = new Service()

    const p1 = s.work(1)
    const p2 = s.work(2)
    const p3 = s.work(3)

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    expect([r1, r2, r3]).toEqual([2, 4, 6])
    expect(calls).toEqual([[1, 2, 3]])
  })

  test('should flush by timeout', async () => {
    const calls: number[][] = []

    class Service {
      work(item: number): Promise<number>
      work(items: number[]): Promise<number[]>

      @Batch({ size: 10, timeoutMs: 30, resultMode: 'perItem' })
      async work(items: number[] | number): Promise<number[] | number> {
        const batch = Array.isArray(items)
          ? items
          : [items]
        calls.push(batch)
        return batch
      }
    }

    const s = new Service()

    const p1 = s.work(1)
    const p2 = s.work(2)

    await sleep(60)

    const [r1, r2] = await Promise.all([p1, p2])

    expect([r1, r2]).toEqual([1, 2])
    expect(calls).toEqual([[1, 2]])
  })

  test('should not run flush concurrently', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const calls: number[][] = []

    class Service {
      work(item: number): Promise<number>
      work(items: number[]): Promise<number[]>

      @Batch({ size: 2, timeoutMs: 1000, resultMode: 'perItem' })
      async work(items: number[] | number): Promise<number[] | number> {
        const batch = Array.isArray(items)
          ? items
          : [items]
        calls.push(batch)
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await sleep(20)
        inFlight--
        return batch
      }
    }

    const s = new Service()

    const p1 = s.work(1)
    const p2 = s.work(2)
    const p3 = s.work(3)
    const p4 = s.work(4)

    const r = await Promise.all([p1, p2, p3, p4])
    expect(r).toEqual([1, 2, 3, 4])

    expect(calls).toEqual([[1, 2], [3, 4]])
    expect(maxInFlight).toBe(1)
  })

  test('auto resultMode should share non-array results', async () => {
    const calls: number[][] = []

    class Service {
      work(item: number): Promise<string>
      work(items: number[]): Promise<string>

      @Batch({ size: 2, timeoutMs: 1000 })
      async work(items: number[] | number): Promise<string> {
        const batch = Array.isArray(items)
          ? items
          : [items]
        calls.push(batch)
        return `n=${batch.length}`
      }
    }

    const s = new Service()

    const [a, b] = await Promise.all([s.work(1), s.work(2)])

    expect(a).toBe('n=2')
    expect(b).toBe('n=2')
    expect(calls).toEqual([[1, 2]])
  })
})
