/**
 * 方法级节流装饰器
 *
 * 典型用途：限制某些高频 handler 的执行频率，例如「导出报表」「触发同步」等。
 * 默认是以「实例维度」进行节流：同一个实例上的同一方法共用一套节流状态。
 *
 * 自动检测同步/异步函数：
 * - 同步函数：冷却期内返回 undefined，否则返回原值
 * - 异步函数：冷却期内返回正在执行的 Promise（复用结果），否则返回新 Promise
 */
export function Throttle(intervalMs: number): MethodDecorator {
  if (intervalMs <= 0)
    throw new Error('Throttle intervalMs must be > 0')

  // per-instance 上次执行时间
  const lastInvokeMap = new WeakMap<object, number>()
  // per-instance 正在执行的 Promise（仅异步函数使用，用于复用结果）
  const pendingMap = new WeakMap<object, Promise<unknown> | null>()

  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value

    if (typeof original !== 'function') {
      throw new TypeError(`@Throttle 只能用于方法，${String(propertyKey)} 不是函数`)
    }

    descriptor.value = function (...args: any[]) {
      const now = Date.now()
      const ctx = this as object

      const lastTime = lastInvokeMap.get(ctx) ?? 0

      /** 处于冷却时间内 */
      if (now - lastTime < intervalMs) {
        const pending = pendingMap.get(ctx) ?? null
        // 异步函数：复用正在执行的 Promise
        if (pending)
          return pending
        // 同步函数：返回 undefined
        return
      }

      lastInvokeMap.set(ctx, now)
      const result = original.apply(this, args)

      /** 检测是否为 Promise-like 对象 */
      const isPromise = result !== null
        && typeof result === 'object'
        && typeof (result as Promise<unknown>).then === 'function'

      if (!isPromise) {
        // 同步函数：直接返回结果
        return result
      }

      // 异步函数：存储 pending 以便复用
      const promise = result as Promise<unknown>
      pendingMap.set(ctx, promise)

      return promise.finally(() => {
        pendingMap.set(ctx, null)
      })
    }
  }
}
