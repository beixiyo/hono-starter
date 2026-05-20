import type { Container } from './container'
import type { InjectableDecorator, PendingEntry, Token } from './types'

/**
 * key 以 (token ?? useClass) 去重，避免热重载或重复 import 导致无限增长。
 */
const registry = new Map<Token | Function, PendingEntry>()

/** 用于标识派生装饰器类型的 key */
const INJECT_TYPE_KEY = '__@inject_type'

// --- 语义化派生装饰器（可选使用）---

/** @Injectable() 或 @Injectable(Token) */
export const Injectable = createInjectable('injectable')

/** 服务层：@Service() 或 @Service(Token) */
export const Service = createInjectable('service')

/** 仓储层：@Repository() 或 @Repository(Token) */
export const Repository = createInjectable('repository')

/**
 * 创建带语义类型的可注入装饰器。
 * 返回的装饰器行为与 Injectable 一致，但会带有 injectType 标识，便于区分 @Service、@Repository 等。
 *
 * @example
 *   const Service = createInjectable('service')
 *   const Repository = createInjectable('repository')
 *   @Service(UserServiceToken) class UserService { ... }
 */
export function createInjectable(injectType: string): InjectableDecorator {
  function decorator(): ClassDecorator
  function decorator<T>(token: Token<T>): ClassDecorator
  function decorator<T>(token?: Token<T>): ClassDecorator {
    return (target: object) => {
      const ctor = typeof target === 'function'
        ? target
        : (target as any).constructor

      const entry: PendingEntry = { token, useClass: ctor, injectType }
      const key = (token ?? ctor) as Token | Function
      registry.set(key, entry)
    }
  }

  const fn = decorator as InjectableDecorator
  ;(fn as any)[INJECT_TYPE_KEY] = injectType

  return fn
}

/**
 * 将当前已收集的所有 @Injectable / @Service 等类注册到指定容器（通常在应用入口调用一次）
 */
export function applyToContainer(container: Container): void {
  for (const entry of registry.values()) {
    const token = entry.token ?? entry.useClass
    container.register(token as Token, entry.useClass)
  }
}
