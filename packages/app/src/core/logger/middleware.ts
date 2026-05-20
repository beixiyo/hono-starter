import type { Context, Env, MiddlewareHandler } from 'hono'
import type { Logger } from 'pino'
import type { LogRouteFilter } from './config'
import { shouldLogRoute } from './match'

export interface RequestLoggerOptions {
  logger: Logger
  filter?: LogRouteFilter
}

export function requestLogger<E extends Env>(options: RequestLoggerOptions): MiddlewareHandler<E> {
  const { logger, filter = {} } = options

  return async (c: Context<E>, next) => {
    const { method, path } = c.req

    if (!shouldLogRoute(path, filter)) {
      return next()
    }

    const requestId = c.get('requestId' as never) as string | undefined
    const start = performance.now()

    await next()

    const duration = Math.round(performance.now() - start)
    const status = c.res.status

    const meta = {
      requestId,
      method,
      path,
      status,
      duration: `${duration}ms`,
    }

    const msg = `${method} ${path} ${status} ${duration}ms`

    if (status >= 400) {
      logger.warn(meta, msg)
    }
    else {
      logger.info(meta, msg)
    }
  }
}
