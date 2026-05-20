import type { Token } from './types'

/** 存在构造函数上的参数 Token 列表，按参数下标排列 */
export const DI_PARAM_TOKENS = Symbol('di:paramTokens')

/**
 * 类级注入装饰器（用于替代参数级 @Inject，解决部分环境下参数装饰器被剥离的问题）
 *
 * @note 传入此装饰器的 Token 顺序，**必须严格等同于**类构造函数 (constructor) 中参数的声明顺序！
 *
 * @see https://github.com/oven-sh/bun/issues/27575
 * @see https://github.com/oven-sh/bun/issues/6326
 *
 * Bun 1.3.10+ 在某些执行环境（如 VSCode 插件 `oven.bun-vscode` 的 `bun test` 或底层 `Bun.Transpiler` 转换时），
 * 即使配置了 `experimentalDecorators: true`，也会强制触发 TC39 Stage 3 装饰器编译，从而丢弃/忽略
 * 构造函数上的参数级 `@Inject` 装饰器，导致运行时依赖被解析为 `undefined`
 * 使用基于类级别（Class Decorator）的 `@Injects` 可完美逃避该编译兼容性问题
 *
 * @example
 * \@Injects(UserServiceToken, DbToken) // 顺序必须对应 constructor
 * export class AuthController {
 *   constructor(
 *     private user: UserService, // 对应 UserServiceToken
 *     private db: Db             // 对应 DbToken
 *   ) {}
 * }
 */
export function Injects(...tokens: Token[]): ClassDecorator {
  return (target: any) => {
    target[DI_PARAM_TOKENS] = tokens
  }
}

/**
 * @Inject(Token) 参数装饰器，用于注入依赖
 * 将构造参数与 Token 关联，供 Container.create() 解析依赖
 */
export function Inject<T>(token: Token<T>): ParameterDecorator {
  /**
   * 将构造参数与 Token 关联，供 Container.create() 解析依赖
   * @param target - 目标对象
   * @param _propertyKey - 属性键
   * @param parameterIndex - 参数索引
   * @returns 参数装饰器
   */
  return (target: object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const ctor = typeof target === 'function'
      ? target
      : (target as object).constructor

    const tokens: (Token | undefined)[] = (ctor as any)[DI_PARAM_TOKENS] ?? []
    tokens[parameterIndex] = token
    ; (ctor as any)[DI_PARAM_TOKENS] = tokens
  }
}
