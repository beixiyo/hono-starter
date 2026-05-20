import type {
  HandlerContextFor as BaseHandlerContextFor,
  HandlerNextFor as BaseHandlerNextFor,
  HandlerReturnFor as BaseHandlerReturnFor,
  MethodName,
  RouteOptions,
} from 'di/hono'
import type { Env } from 'hono'
import type { AppEnv } from '@/types'

export * from './constants'
export * from './error-handler'
export * from './logger'
export * from './middleware'
export * from './openapi'
export * from './response'
export * from './static-server'

export { createRoute } from '@hono/zod-openapi'

/** 显式重导出 di/hono，并将 HandlerContextFor 等类型的默认 Env 覆盖为 AppEnv */
export {
  createDeleteRoute,
  createGetRoute,
  createOptionsRoute,
  createPatchRoute,
  createPostRoute,
  createPutRoute,
  createRouteOptions,
  Delete,
  Get,
  HonoRouteRegistry,
  Options,
  Patch,
  Post,
  Put,
} from 'di/hono'

export type {
  HandlerContext,
  HandlerNext,
  HandlerReturn,
  HonoRouteMeta,
  MethodName,
  RequestSchemaHint,
  RouteConfig,
  RouteOptions,
} from 'di/hono'

export type HandlerContextFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = AppEnv,
> = BaseHandlerContextFor<O, M, E>

export type HandlerReturnFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = AppEnv,
> = BaseHandlerReturnFor<O, M, E>

export type HandlerNextFor<
  O extends RouteOptions,
  M extends MethodName = 'post',
  E extends Env = AppEnv,
> = BaseHandlerNextFor<O, M, E>
