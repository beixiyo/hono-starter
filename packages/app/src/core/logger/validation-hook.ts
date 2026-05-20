import type { Context, Env } from 'hono'
import type { Logger } from 'pino'
import type { ZodError } from 'zod'

interface ValidationResult {
  success: boolean
  error?: ZodError
}

export interface ValidationHookOptions {
  logger: Logger
}

export function createValidationHook({ logger }: ValidationHookOptions) {
  return async (result: ValidationResult, c: Context<Env>) => {
    if (result.success)
      return

    const requestId = c.get('requestId' as never) as string | undefined
    const { method, path } = c.req
    const errors = result.error!.flatten()

    const input: Record<string, unknown> = {
      query: c.req.query(),
      params: c.req.param(),
    }

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        input.body = await c.req.json()
      }
      catch {
        input.body = await c.req.text().catch(() => '(unreadable)')
      }
    }

    logger.warn(
      { requestId, method, path, input, errors },
      `参数校验失败 ${method} ${path}`,
    )

    return c.json({
      success: false,
      message: '参数校验失败',
      errors,
      data: null,
      requestId,
    }, 400)
  }
}
