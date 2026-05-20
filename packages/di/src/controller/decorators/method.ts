import type { HttpMethod, RouteMeta } from '../types'
import { normalizePath } from '../../utils/path'
import { addRoute } from './meta'

export type MethodDecoratorFactory<Meta = unknown> = {
  (path: string): MethodDecorator
  (path: string, adapterMeta: Meta): MethodDecorator
  (path: string, adapterMeta: Meta, handlerOptions: HandlerOptions): MethodDecorator
}

export interface HandlerOptions {
  /** 是否自动用统一响应格式包装返回值，默认 true */
  wrapResponse?: boolean
}

/**
 * 创建 HTTP 方法装饰器工厂
 *
 * Meta 为适配器定义的元信息类型（如 OpenAPI 配置等），在具体适配器中通过
 * createMethodDecorator<Meta>() 显式传入以获得严格类型。
 */
export function createMethodDecorator<Meta = unknown>(method: HttpMethod): MethodDecoratorFactory<Meta> {
  const factory: MethodDecoratorFactory<Meta> = (
    path: string,
    adapterMeta?: Meta,
    handlerOptions?: HandlerOptions,
  ) => {
    return (target: object, propertyKey: string | symbol) => {
      const meta: RouteMeta = {
        handlerName: propertyKey.toString(),
        method,
        path: normalizePath(path),
      }

      if (adapterMeta !== undefined || handlerOptions !== undefined) {
        const base: any = adapterMeta ?? {}
        if (handlerOptions !== undefined) {
          base.handlerOptions = handlerOptions
        }
        meta.adapterMeta = base
      }

      addRoute(target, meta)
    }
  }

  return factory
}
