import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { MESSAGE_CONFIG } from '@/core'
import { logger } from './logger'
import { jsonFail } from './response'

export function errorHandler(err: Error, c: Context) {
  const requestId = c.get('requestId')

  if (err instanceof HTTPException) {
    return jsonFail(c, err.message || MESSAGE_CONFIG.errorDefault, err.status)
  }

  logger.error(
    `${c.req.method} ${c.req.path} 未捕获异常`,
    err,
    { meta: { requestId, method: c.req.method, path: c.req.path } },
  )

  return jsonFail(c, err.message || MESSAGE_CONFIG.internalServerErrorDefault, 500)
}

export function notFoundHandler(c: Context) {
  return jsonFail(c, `${MESSAGE_CONFIG.notFoundPrefix}${c.req.path}`, 404)
}
