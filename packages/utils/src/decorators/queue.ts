/**
 * 方法级队列装饰器
 *
 * 作用：保证同一实例上的同一方法「串行执行」，后来的调用会排队等待前一个完成。
 * 适合用在「不允许并发」的场景，比如：
 * - 某些需要顺序写数据库/文件的操作
 * - 与外部服务交互时要求严格顺序
 */
export function Queue(): MethodDecorator {
  // per-instance 队列尾 Promise
  const tailMap = new WeakMap<object, Promise<unknown>>()

  return (target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value

    if (typeof original !== 'function') {
      throw new TypeError(`@Queue 只能用于方法，${String(propertyKey)} 不是函数`)
    }

    descriptor.value = function (...args: any[]) {
      const ctx = this as object

      const tail = tailMap.get(ctx) ?? Promise.resolve()

      const run = async () => {
        return await original.apply(this, args)
      }

      const next = tail.then(run, run)
      tailMap.set(ctx, next)

      return next
    }
  }
}
