import type { RouteHandler } from '@hono/zod-openapi'
import type { ControllerClass, RouteMeta, RouteRegistry } from 'di'
import type { Context, Env } from 'hono'
import type { HonoRouteMeta, RequestSchemaHint, RouteConfig, RouteOptions } from './types'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { getParamMeta } from 'di'
import { buildArgs } from './args'

export * from './decorator'
export * from './types'

/**
 * Hono 适配器配置
 */
export interface HonoRouteRegistryOptions<E extends Env = Env> {
  /**
   * 当 handler 返回非 Response 且 wrapResponse 为 true 时，用此函数包装结果
   * @default (c, data) => c.json(data)
   */
  wrapResponseFn?: (c: Context<E>, data: unknown) => Response
  /** 传递给每个 OpenAPIHono 子路由的默认校验 hook */
  defaultHook?: ConstructorParameters<typeof OpenAPIHono>[0] extends infer O
    ? O extends { defaultHook?: infer H } ? H : never
    : never
}

/**
 * HonoRouteRegistry 实现
 */
export class HonoRouteRegistry<E extends Env = Env> implements RouteRegistry {
  constructor(
    private app: OpenAPIHono<E>,
    private basePath = '',
    private module: OpenAPIHono<E> | null = null,
    private options: HonoRouteRegistryOptions<E> = {},
  ) {}

  registerRoute(meta: RouteMeta, handler: Function, instance: object): void {
    const { method, path, adapterMeta } = this.normalizeMeta(meta)
    const routeObject = this.createRouteObject(method, path, adapterMeta)

    const paramMeta = getParamMeta(instance.constructor as ControllerClass, meta.handlerName)
    const requestSchema = this.extractRequestSchema(adapterMeta)
    const { wrapResponse } = this.resolveHandlerOptions(adapterMeta)

    const wrappedHandler = this.createWrappedHandler(
      handler,
      instance,
      paramMeta,
      requestSchema,
      wrapResponse,
    )

    const targetApp = this.module ?? this.app
    targetApp.openapi(routeObject, wrappedHandler as RouteHandler<any, E>)
  }

  /** 规范化并校验路由元信息 */
  private normalizeMeta(meta: RouteMeta) {
    const honoMeta = meta as HonoRouteMeta & { fullPath?: string }
    const { method, path, adapterMeta } = honoMeta

    if (!method || !path) {
      throw new Error('RouteMeta must have method and path')
    }

    /** 校验一致性 */
    if (adapterMeta) {
      const anyMeta = adapterMeta as any
      if (anyMeta.method && anyMeta.method !== method) {
        throw new Error(`Route method conflict: decorator defines "${method}" but adapterMeta defines "${anyMeta.method}"`)
      }

      const expectedPath = honoMeta.fullPath ?? honoMeta.path ?? '/'
      if (anyMeta.path) {
        const nExpected = normalizePathParams(expectedPath)
        const nAdapter = normalizePathParams(anyMeta.path)
        if (nExpected !== nAdapter) {
          throw new Error(`Route path conflict: decorator defines "${expectedPath}" but adapterMeta defines "${anyMeta.path}"`)
        }
      }
    }

    return { method, path, adapterMeta }
  }

  /** 基于 method/path/adapterMeta 构建 OpenAPI 路由 */
  private createRouteObject(
    method: RouteConfig['method'],
    path: string,
    adapterMeta?: RouteOptions,
  ) {
    const anyMeta = (adapterMeta ?? ({} as RouteOptions)) as any
    const { method: _ignoredMethod, path: _ignoredPath, ...rest } = anyMeta
    return createRoute({
      ...rest,
      method,
      path,
    })
  }

  /** 从 adapterMeta 中提取 request 部分的 schema，用于参数构建 */
  private extractRequestSchema(adapterMeta?: RouteOptions): RequestSchemaHint | undefined {
    if (!adapterMeta?.request)
      return undefined

    return {
      body: adapterMeta.request.body,
      form: adapterMeta.request.body,
      params: adapterMeta.request.params,
      query: adapterMeta.request.query,
    }
  }

  /** 解析 handler 级别配置 */
  private resolveHandlerOptions(adapterMeta?: RouteOptions) {
    const handlerOptions = adapterMeta?.handlerOptions
    const wrapResponse = handlerOptions?.wrapResponse ?? true
    return { wrapResponse }
  }

  /** 创建真正注册到 Hono 的 handler，负责参数注入与统一响应处理 */
  private createWrappedHandler(
    handler: Function,
    instance: object,
    paramMeta: ReturnType<typeof getParamMeta> | undefined,
    requestSchema: RequestSchemaHint | undefined,
    wrapResponse: boolean,
  ) {
    const hasParamInjection = paramMeta?.some(Boolean)
    const wrapFn = this.options.wrapResponseFn

    const wrappedHandler = async (c: Context<E>, next: () => Promise<void>) => {
      const args = hasParamInjection
        ? await buildArgs(c, next, paramMeta!, requestSchema)
        : [c, next]

      const result = await (handler as Function).apply(instance, args)

      if (result instanceof Response)
        return result

      if (!wrapResponse)
        return c.json(result) as Response

      return wrapFn
        ? wrapFn(c, result)
        : (c.json(result) as Response)
    }

    return wrappedHandler as RouteHandler<any, E>
  }

  createScope(basePath: string): RouteRegistry {
    const module = new OpenAPIHono<E>({
      defaultHook: this.options.defaultHook as any,
    })
    return new HonoRouteRegistry<E>(this.app, basePath, module, this.options)
  }

  finalize(): void {
    if (this.module && this.basePath) {
      this.app.route(this.basePath, this.module)
    }
  }
}

/**
 * Hono 路由工厂
 */
export const createGetRoute = createMethodRoute('get')
export const createPostRoute = createMethodRoute('post')
export const createPutRoute = createMethodRoute('put')
export const createPatchRoute = createMethodRoute('patch')
export const createDeleteRoute = createMethodRoute('delete')
export const createOptionsRoute = createMethodRoute('options')

/**
 * 创建路由选项（不包含 path/method）
 */
export function createRouteOptions<O extends RouteOptions>(options: O): O {
  return options
}

function createMethodRoute<M extends RouteConfig['method']>(method: M) {
  return <O extends Omit<RouteConfig, 'method' | 'path'>>(path: string, options: O) =>
    createRoute({ method, path, ...options })
}

function normalizePathParams(path: string): string {
  return path.replace(/:(\w+)/g, (_, name) => `{${name}}`)
}
