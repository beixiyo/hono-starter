import type { HandlerParamMeta, ParamMeta } from 'di'
import type { Context, Env } from 'hono'
import type { RequestSchemaHint } from './types'

/** 根据 ParamMeta 从 Hono Context 取值；若路由带了对应 schema 则用校验后的值（仅 Hono 适配器使用） */
export async function getValueFromContext<E extends Env = Env>(
  c: Context<E>,
  meta: ParamMeta,
  requestSchema: RequestSchemaHint | undefined,
): Promise<unknown> {
  switch (meta.source) {
    case 'body': {
      const body = requestSchema?.body
        ? (c.req.valid as any)('json')
        : await c.req.json()
      return meta.key
        ? (body as Record<string, unknown>)?.[meta.key]
        : body
    }
    case 'form': {
      const form = requestSchema?.form
        ? (c.req.valid as any)('form')
        : await c.req.parseBody()
      return meta.key
        ? (form as Record<string, unknown>)?.[meta.key]
        : form
    }
    case 'params': {
      const params = requestSchema?.params
        ? (c.req.valid as any)('param')
        : c.req.param()
      return meta.key
        ? params[meta.key]
        : params
    }
    case 'query': {
      const query = requestSchema?.query
        ? (c.req.valid as any)('query')
        : c.req.query()
      return meta.key
        ? query[meta.key]
        : query
    }
    default:
      return undefined
  }
}

/** 根据参数元数据从 c/next 构建 handler 实参列表 */
export async function buildArgs<E extends Env = Env>(
  c: Context<E>,
  next: () => Promise<void>,
  paramMeta: HandlerParamMeta,
  requestSchema: RequestSchemaHint | undefined,
): Promise<unknown[]> {
  const len = Math.max(paramMeta.length, 2)
  const args: unknown[] = []
  const contextRest: [Context<E>, () => Promise<void>] = [c, next]

  let contextIndex = 0
  for (let i = 0; i < len; i++) {
    const m = paramMeta[i]
    if (m) {
      if (m.source === 'context')
        args[i] = c
      else if (m.source === 'next')
        args[i] = next
      else
        args[i] = await getValueFromContext(c, m, requestSchema)
    }
    else {
      /** 未显式标注来源时：仅按顺序兜底注入 (c, next)；超过 2 个位置保持 undefined */
      if (contextIndex < contextRest.length)
        args[i] = contextRest[contextIndex++]
      else
        args[i] = undefined
    }
  }
  return args
}
