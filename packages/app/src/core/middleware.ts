import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../types'
import { cache } from 'hono/cache'
import { compress } from 'hono/compress'
import { etag } from 'hono/etag'
import { jwt } from 'hono/jwt'
import { prettyJSON } from 'hono/pretty-json'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { JWT_CONFIG, JWT_PUBLIC_PATHS } from './constants'
import { defaultLoggerConfig, logger, requestLogger } from './logger'

export function registerMiddleware(app: OpenAPIHono<AppEnv>) {
  /** 基础与安全 */
  app.use('*', requestId())
  app.use('*', requestLogger({ logger, filter: defaultLoggerConfig.request }))
  // app.use('*', cors())

  // JWT 校验（统一在此）
  const jwtMiddleware = jwt({ secret: JWT_CONFIG.secret, alg: 'HS256' })
  app.use('/api/*', async (c, next) => {
    if (JWT_PUBLIC_PATHS.has(c.req.path)) {
      return next()
    }

    return jwtMiddleware(c, next)
  })

  // app.use('*', csrf())
  app.use('*', secureHeaders())
  app.use('*', prettyJSON())

  /** 性能优化 */
  app.use('*', compress())
  app.use('*', etag())

  /** 缓存 (仅 GET，在支持 Cache API 的环境下启用) */
  if ('caches' in globalThis) {
    app.get('*', cache({ cacheName: 'my-app', cacheControl: 'max-age=3600' }))
  }
}
