/**
 * 依赖注入核心类型
 */

/** 可作为 Token 的类型：Symbol 或类（构造函数） */
export type Token<T = unknown> = symbol | (new (...args: any[]) => T) | (abstract new (...args: any[]) => T)

/** 生命周期：单例每次 resolve 同一实例，瞬态每次创建新实例 */
export type Scope = 'singleton' | 'transient'

/** 单条绑定配置（多参数时使用） */
export interface BindingOptions<T = unknown> {
  token: Token<T>
  useClass?: new (...args: any[]) => T
  useFactory?: () => T
  useValue?: T
  scope?: Scope
}

/**
 * 内部存储的绑定
 * 一条 Binding 表示容器中某个 Token 到实现的完整映射关系，
 * 包含实现类型（类 / 工厂 / 常量）、生命周期以及已创建的实例缓存。
 */
export interface Binding<T = unknown> {
  /** 用于查找绑定的 Token（Symbol 或构造函数） */
  token: Token
  /** 绑定类型：class=类构造；factory=工厂函数；value=已给定常量值 */
  type: 'class' | 'factory' | 'value'
  /** 当 type 为 'class' 时使用的构造函数 */
  useClass?: new (...args: any[]) => T
  /** 当 type 为 'factory' 时使用的工厂函数 */
  useFactory?: () => T
  /** 当 type 为 'value' 时直接返回的常量值 */
  useValue?: T
  /** 生命周期：'singleton' 单例复用，'transient' 每次 resolve 都新建 */
  scope: Scope
  /**
   * 已创建的实例缓存，仅在 scope 为 'singleton' 时使用。
   * 首次 resolve 时写入，后续同一 Token 再次 resolve 将直接复用此实例。
   */
  instance?: T
}

/** 待注册表条目（applyToContainer 前收集） */
export interface PendingEntry {
  token?: Token
  useClass: new (...args: any[]) => any
  /** 由 createInjectable(type) 派生装饰器填入，如 'service' / 'repository' */
  injectType?: string
}

/** 可注入装饰器类型（Injectable 或 createInjectable 返回值） */
export type InjectableDecorator = {
  (): ClassDecorator
  <T>(token: Token<T>): ClassDecorator
  /** 派生装饰器会带有 injectType 标识 */
  injectType?: string
}
