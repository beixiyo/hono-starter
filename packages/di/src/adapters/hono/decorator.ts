import type { RouteConfig, RouteOptions } from './types'
import { createMethodDecorator } from 'di'

/**
 * 基于 Hono 适配器的严格类型 HTTP 方法装饰器
 *
 * - 第二个参数为 OpenAPI 路由选项 `RouteOptions`
 * - 第三个参数为 handler 级别配置 `HandlerOptions`
 *
 * 示例：
 * @Get('/path', routeOptions)
 * @Post('/path', routeOptions, { wrapResponse: false })
 */
export const Get = createMethodDecorator<RouteOptions | RouteConfig>('get')
export const Post = createMethodDecorator<RouteOptions | RouteConfig>('post')
export const Put = createMethodDecorator<RouteOptions | RouteConfig>('put')
export const Delete = createMethodDecorator<RouteOptions | RouteConfig>('delete')
export const Patch = createMethodDecorator<RouteOptions | RouteConfig>('patch')
export const Options = createMethodDecorator<RouteOptions | RouteConfig>('options')
