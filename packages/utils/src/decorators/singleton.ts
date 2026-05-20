/**
 * 单例类装饰器
 *
 * 作用：保证同一个类在进程内只会被实例化一次，后续 `new` 调用都返回同一个实例。
 * 适合放在无需 DI 容器管理、但又希望全局复用的工具类上。
 */
export function Singleton(): ClassDecorator {
  /** 记录每个类对应的单例实例 */
  const instanceMap = new WeakMap<Function, any>()

  return (target) => {
    const Original = target as unknown as new (...args: any[]) => any

    const Wrapped = function (this: any, ...args: any[]) {
      let instance = instanceMap.get(Original)
      if (!instance) {
        instance = new Original(...args)
        instanceMap.set(Original, instance)
      }
      return instance
    } as unknown as new (...args: any[]) => any

    Wrapped.prototype = Original.prototype

    return Wrapped as unknown as typeof target
  }
}
