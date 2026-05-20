import type { ControllerClass, HandlerParamMeta, ParamMeta } from '../types'
import { PARAM_META_KEY } from '../constants'

function addParamMeta(target: object, propertyKey: string | symbol, parameterIndex: number, meta: ParamMeta): void {
  const constructor = (target as any).constructor
  const map: Record<string, HandlerParamMeta> = (constructor as any)[PARAM_META_KEY] ?? {}
  const key = propertyKey.toString()
  const arr: HandlerParamMeta = map[key] ?? []
  if (parameterIndex >= arr.length) {
    for (let i = arr.length; i <= parameterIndex; i++) arr[i] = undefined
  }
  arr[parameterIndex] = meta
  map[key] = arr
  ;(constructor as any)[PARAM_META_KEY] = map
}

/**
 * 获取指定 handler 的参数注入元数据（按参数下标）
 * 供框架适配器在 registerRoute 时包装 handler、从 request 注入参数
 */
export function getParamMeta(controllerClass: ControllerClass, handlerName: string): HandlerParamMeta | undefined {
  const map: Record<string, HandlerParamMeta> | undefined = (controllerClass as any)[PARAM_META_KEY]
  return map?.[handlerName]
}

/**
 * @Body() 请求体注入（框架适配器用 req.body / c.req.json() 等实现）
 * @param key 可选，取 body 的某字段
 */
export function Body(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'body', key })
  }
}

/**
 * @Form() 表单/multipart 注入（框架适配器用 req.form / c.req.valid('form') 等实现）
 * @param key 可选，取表单某字段，如 @Form('file')；不传则返回整个 form 对象
 */
export function Form(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'form', key })
  }
}

/**
 * @Params() 路径参数注入（框架适配器用 req.params / c.req.param() 等实现）
 * @param key 可选，取单个 param，如 @Params('id')；不传则返回整个 params 对象
 */
export function Params(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'params', key })
  }
}

/**
 * @Query() 查询参数注入（框架适配器用 req.query / c.req.query() 等实现）
 * @param key 可选，取单个 query，如 @Query('page')；不传则返回整个 query 对象
 */
export function Query(key?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'query', key })
  }
}

/**
 * @Context() 注入框架请求上下文（如 Hono 的 Context）
 * 框架适配器将 c 注入到此参数
 */
export function Context(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'context' })
  }
}

/**
 * @Next() 注入框架的 next 函数（如 Koa/Hono 的 next）
 * 框架适配器将 next 注入到此参数
 */
export function Next(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    addParamMeta(target as object, propertyKey!, parameterIndex, { source: 'next' })
  }
}
