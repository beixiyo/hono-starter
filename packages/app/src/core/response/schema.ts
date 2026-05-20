import type { ZodTypeAny } from 'zod'
import { z } from '@hono/zod-openapi'

const PaginationSchema = z.object({
  page: z.number().int().min(1).openapi({ example: 1 }),
  pageSize: z.number().int().min(1).openapi({ example: 10 }),
  total: z.number().int().min(0).openapi({ example: 100 }),
  totalPages: z.number().int().min(0).openapi({ example: 10 }),
}).openapi('Pagination')

export function createSuccessSchema<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true).openapi({ example: true }),
    message: z.string().openapi({ example: '成功' }),
    data: dataSchema,
    requestId: z.string().optional().openapi({ example: 'req_123' }),
  })
}

export function createPagedSuccessSchema<T extends ZodTypeAny>(dataSchema: T) {
  return createSuccessSchema(dataSchema).extend({
    pagination: PaginationSchema,
  })
}

export function createErrorSchema() {
  return z.object({
    success: z.literal(false).openapi({ example: false }),
    message: z.string().openapi({ example: '错误信息' }),
    data: z.null().openapi({ example: null }),
    requestId: z.string().optional().openapi({ example: 'req_123' }),
  })
}
