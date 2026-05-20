import { createRoute, z } from '@hono/zod-openapi'
import { createSuccessSchema } from '@/core'
import { ParamsSchema, UserSchema } from './schema'

export const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['用户管理'],
  summary: '获取用户信息',
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({
        success: z.literal(true).openapi({ example: true }),
        message: z.string().openapi({ example: '成功' }),
        data: UserSchema,
        requestId: z.string().optional().openapi({ example: 'req_123' }),
      }) } },
      description: '获取成功',
    },
  },
})

const s = createSuccessSchema(UserSchema)
export const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['用户管理'],
  summary: '创建用户',
  request: {
    body: {
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: s } },
      description: '创建成功',
    },
  },
})

export type CreateUserBody = z.infer<typeof UserSchema>

export const userApi = {
  getUser: getUserRoute,
  createUser: createUserRoute,
}
