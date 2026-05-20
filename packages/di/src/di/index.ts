/**
 * 依赖注入模块
 *
 * 框架无关，来自 @shared/core/di
 *
 * 单参数（函数重载）：
 *   container.register(UserService)                    // Token = 类自身
 *   container.register(UserServiceToken, UserService)  // Token + 实现类
 *   container.register(UserServiceToken, () => impl)   // Token + 工厂
 *   container.register(UserServiceToken, instance)     // Token + 常值
 *   container.resolve(UserServiceToken)
 *
 * 多参数（配置项）：
 *   container.register({ token: X, useClass: Y, scope: 'singleton' })
 *   container.register({ token: X, useFactory: () => Y, scope: 'transient' })
 *   container.register({ token: X, useValue: instance })
 *
 * Controller 中声明依赖：constructor(@Inject(UserServiceToken) private svc: IUserService) {}
 * 入口处：registerControllers(app, { container })
 *
 * 自动注册：在 Service 类上使用 @Injectable() 或 @Injectable(Token)，入口调用 applyToContainer(container) 即可，无需手写 register。
 */

export { Container } from './container'
export { DI_PARAM_TOKENS, Inject, Injects } from './inject'
export { applyToContainer, createInjectable, Injectable, Repository, Service } from './injectable'
export type { Binding, BindingOptions, InjectableDecorator, PendingEntry, Scope, Token } from './types'
