import type { createRoute, RouteHandler } from '@hono/zod-openapi'
import type { HandlerOptions, RouteMeta } from 'di'
import type { Env } from 'hono'

/**
 * 路由配置类型
 */
export type RouteConfig = Parameters<typeof createRoute>[0]

/**
 * 路由选项类型（不含 path/method）
 */
export type RouteOptions = Omit<RouteConfig, 'method' | 'path'> & {
  /** 每个 handler 级别的额外配置（由装饰器第三个参数传入） */
  handlerOptions?: HandlerOptions
}

/**
 * HTTP 方法名
 */
export type MethodName = RouteConfig['method']

/**
 * 从 OpenAPI 路由推导 handler 类型
 * @param E Hono Env 类型，需满足 Env 约束
 */
export type HandlerContext<R extends RouteConfig, E extends Env = Env>
  = Parameters<RouteHandler<R, E>>[0]
export type HandlerReturn<R extends RouteConfig, E extends Env = Env>
  = ReturnType<RouteHandler<R, E>>
export type HandlerNext<R extends RouteConfig, E extends Env = Env>
  = Parameters<RouteHandler<R, E>>[1]

/**
 * 仅用 method + options 推导 handler 类型
 */
export type HandlerContextFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = Env,
> = HandlerContext<{ method: M, path: string } & O, E>

export type HandlerReturnFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = Env,
> = HandlerReturn<{ method: M, path: string } & O, E>

export type HandlerNextFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = Env,
> = HandlerNext<{ method: M, path: string } & O, E>

export type HonoRouteMeta = RouteMeta & { adapterMeta?: RouteOptions }

/**
 * 路由是否声明了 request 中各部分的 schema（有则走 c.req.valid 校验后的值）
 *
 * 注意：OpenAPI 的表单/multipart 同样通过 request.body 描述，这里额外提供 form 作为语义别名，
 * 便于适配器在处理 @Form 时更直观。
 */
export type RequestSchemaHint = {
  body?: NonNullable<RouteOptions['request']>['body']
  /** 语义别名：等同于 body（用于 @Form） */
  form?: NonNullable<RouteOptions['request']>['body']
  params?: NonNullable<RouteOptions['request']>['params']
  query?: NonNullable<RouteOptions['request']>['query']
}
