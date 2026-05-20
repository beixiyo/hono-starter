import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * API 成功响应结构
 * @default { success: true, message: '成功' }
 */
export type ApiSuccessResponse<T> = {
  success: true
  message: string
  data: T
  requestId?: string
  pagination?: PaginationInfo
}

/**
 * API 错误响应结构
 * @default { success: false, message: '错误信息', data: null }
 */
export type ApiErrorResponse = {
  success: false
  message: string
  data: null
  requestId?: string
}

/**
 * 分页信息
 * @default { page: 1, pageSize: 10, total: 0, totalPages: 0 }
 */
export type PaginationInfo = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * 成功响应选项
 * @default { status: 200, message: '成功' }
 */
export type JsonOkOptions = {
  status?: ContentfulStatusCode
  message?: string
  pagination?: PaginationInfo
}
