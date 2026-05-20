import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiErrorResponse, ApiSuccessResponse, JsonOkOptions } from '@/types'
import { MESSAGE_CONFIG } from '../constants'

/**
 * 成功响应函数
 *
 * 问题根源：
 * - Hono 的 `c.json()` 返回类型 `JSONRespondReturn<T, ContentfulStatusCode>` 是宽泛的，
 *   包含了所有可能的状态码（100-511），而不是路由配置中定义的具体状态码（如字面量 200）
 * - 这导致即使路由配置只有一个 200 响应，TypeScript 也无法匹配类型
 *
 * 解决方案：
 * - 返回类型使用 `any`，并在函数内部使用 `as any` 类型断言
 * - 这样调用处的类型推断能够正常工作，无需在每个调用处都使用类型断言
 * - 这是 Hono 类型系统的限制，需要在函数内部进行类型断言
 */
export function jsonOk<R, T, C extends Context>(
  c: C,
  data: T,
  options?: JsonOkOptions,
): any {
  const body: ApiSuccessResponse<T> = {
    success: true,
    message: options?.message ?? MESSAGE_CONFIG.successDefault,
    data,
    requestId: c.get('requestId'),
  }

  if (options?.pagination) {
    body.pagination = options.pagination
  }

  return c.json(body, {
    ...options,
    status: (options?.status ?? 200) as ContentfulStatusCode,
  }) as R
}

/**
 * 失败响应函数
 */
export function jsonFail<R, C extends Context>(
  c: C,
  message: string,
  status: ContentfulStatusCode = 400 as ContentfulStatusCode,
): any {
  const body: ApiErrorResponse = {
    success: false,
    message,
    data: null,
    requestId: c.get('requestId'),
  }

  return c.json(body, {
    status,
  }) as R
}
