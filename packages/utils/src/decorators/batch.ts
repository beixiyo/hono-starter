export type BatchResultMode = 'auto' | 'perItem' | 'shared'

export type BatchCollectMode = 'first' | 'args'

export interface BatchOptions {
  /**
   * 触发 flush 的最大条数（到达即触发）
   */
  size: number
  /**
   * 触发 flush 的最大等待时间（ms，首次入队开始计时）
   */
  timeoutMs: number
  /**
   * 返回结果分发模式：
   * - auto：若原方法返回数组则按下标分发，否则共享同一个返回值给本批所有调用者
   * - perItem：要求原方法返回数组，并按下标分发
   * - shared：无论返回什么，都共享同一个返回值给本批所有调用者
   */
  resultMode?: BatchResultMode
  /**
   * 收集入队内容的方式：
   * - first：只收集第一个参数（推荐：把多参数包装成对象传入）
   * - args：收集整组参数（作为一个 tuple）
   */
  collectMode?: BatchCollectMode
}

type PendingEntry = {
  item: unknown
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}

type BatchState = {
  buffer: PendingEntry[]
  timer: ReturnType<typeof setTimeout> | null
  flushTail: Promise<void>
}

/**
 * 方法级批处理装饰器
 *
 * 用法建议（TypeScript 友好）：
 * - 让实现方法接收「数组」（批次），并返回「数组」或共享返回值
 * - 再用 overload 提供「单条调用」的签名给调用方
 *
 * 示例：
 *
 * class Svc {
 *   work(item: number): Promise<number>
 *   work(items: number[]): Promise<number[]>
 *   @Batch({ size: 100, timeoutMs: 5000, resultMode: 'perItem' })
 *   async work(items: number[] | number): Promise<number[] | number> {
 *     const batch = Array.isArray(items) ? items : [items]
 *     return batch.map(x => x * 2)
 *   }
 * }
 */
export function Batch(options: BatchOptions): MethodDecorator {
  const {
    size,
    timeoutMs,
    resultMode = 'auto',
    collectMode = 'first',
  } = options

  if (!Number.isFinite(size) || size <= 0)
    throw new Error('Batch size must be a positive number')
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error('Batch timeoutMs must be a positive number')

  const stateMap = new WeakMap<object, BatchState>()

  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value

    if (typeof original !== 'function') {
      throw new TypeError(`@Batch 只能用于方法，${String(propertyKey)} 不是函数`)
    }

    const getState = (ctx: object): BatchState => {
      let state = stateMap.get(ctx)
      if (!state) {
        state = {
          buffer: [],
          timer: null,
          flushTail: Promise.resolve(),
        }
        stateMap.set(ctx, state)
      }
      return state
    }

    const clearTimer = (state: BatchState) => {
      if (state.timer) {
        clearTimeout(state.timer)
        state.timer = null
      }
    }

    const doFlush = (thisArg: any, state: BatchState) => {
      if (state.buffer.length === 0)
        return

      const entries = state.buffer
      state.buffer = []
      clearTimer(state)

      const items = entries.map(e => e.item)

      const invoke = async () => {
        try {
          const result = await Promise.resolve(original.call(thisArg, items))

          if (resultMode === 'shared') {
            for (const e of entries)
              e.resolve(result)
            return
          }

          const isArray = Array.isArray(result)
          if (resultMode === 'auto' && !isArray) {
            for (const e of entries)
              e.resolve(result)
            return
          }

          if (!isArray) {
            throw new TypeError(
              `@Batch(perItem) 期望 ${String(propertyKey)} 返回数组以逐条分发结果`,
            )
          }

          if (result.length !== entries.length) {
            throw new RangeError(
              `@Batch 结果数组长度(${result.length})与批次长度(${entries.length})不一致`,
            )
          }

          for (let i = 0; i < entries.length; i++)
            entries[i]!.resolve(result[i])
        }
        catch (err) {
          for (const e of entries)
            e.reject(err)
        }
      }

      state.flushTail = state.flushTail.then(invoke, invoke)
    }

    descriptor.value = function (...args: any[]) {
      const ctx = this as object
      const state = getState(ctx)

      const item = collectMode === 'args'
        ? args
        : args[0]

      const p = new Promise<unknown>((resolve, reject) => {
        state.buffer.push({ item, resolve, reject })
      })

      if (state.buffer.length === 1) {
        state.timer = setTimeout(() => {
          const s = getState(ctx)
          doFlush(this, s)
        }, timeoutMs)
      }

      if (state.buffer.length >= size) {
        doFlush(this, state)
      }

      return p
    }
  }
}
