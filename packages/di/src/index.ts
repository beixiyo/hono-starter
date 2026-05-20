/**
 * DI 主入口
 *
 * - 容器: `createContainer`、`Container`
 * - 注入: `Inject`
 * - 依赖收集: `Injectable | Service | Repository`
 * - Controller: `@Controller` + `@Get/@Post/...` + `registerControllers`
 *
 * 示例（伪代码，仅展示用法）:
 * @example
 * ```ts
 * import { createContainer, Service, Inject, Controller, Get, Post, registerControllers } from 'di'
 *
 * @Service()
 * class UserService {
 *   findAll() { ... }
 * }
 *
 * ========================================================
 *
 * @Controller('/users')
 * class UserController {
 *   constructor(@Inject(UserService) private readonly service: UserService) {}
 *
 *   @Get('/', { adapterMeta: 由框架适配器解释的路由配置 })
 *   list() { ... }
 *
 *   @Post('/', { adapterMeta: 由框架适配器解释的路由配置 })
 *   create() { ... }
 * }
 *
 * ========================================================
 *
 * const container = createContainer()
 * // 由应用层提供 RouteRegistry 实现（如 HonoRouteRegistry）
 * registerControllers(routeRegistry, { container, globalPrefix: '/api' })
 * ```
 */
export * from './di'
export * from './utils'
export * from './controller'
