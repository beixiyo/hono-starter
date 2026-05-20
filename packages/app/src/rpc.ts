/**
 * RPC 类型入口：仅用于导出 Hono RPC 类型给前端消费
 * 影子应用不包含中间件、数据库连接或 DI 容器逻辑
 */
import { OpenAPIHono } from '@hono/zod-openapi'
import { authApi } from './modules/auth/route'
import { userApi } from './modules/user/route'

const app = new OpenAPIHono()
  .openapi(userApi.getUser, () => ({} as any))
  .openapi(userApi.createUser, () => ({} as any))
  .openapi(authApi.login, () => ({} as any))
  .openapi(authApi.jwtProtected, () => ({} as any))

export type AppType = typeof app
