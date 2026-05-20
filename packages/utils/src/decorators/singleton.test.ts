import { describe, expect, test } from 'bun:test'
import { Singleton } from './singleton'

describe('Singleton', () => {
  test('should always return the same instance', () => {
    @Singleton()
    class SingleService {
      value = 0
    }

    const a = new SingleService()
    const b = new SingleService()

    expect(a).toBe(b)

    a.value = 123
    expect(b.value).toBe(123)
  })
})
