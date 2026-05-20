import type { HandlerContextFor } from '@/core'
import { createRoute, z } from '@hono/zod-openapi'
import { createErrorSchema } from '@/core'
import { createSuccessSchema } from '@/core/response'
import { AdminLoginSchema, AdminLogoutSchema, AdminRefreshTokenSchema, MessageSchema } from './schema'

export const jwtProtectedRoute = createRoute({
  method: 'get',
  path: '/auth/jwt/protected',
  tags: ['身份认证'],
  summary: 'JWT 受保护接口',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      content: {
        'application/json': { schema: createSuccessSchema(MessageSchema) },
      },
      description: '成功',
    },
    401: {
      content: {
        'application/json': { schema: createErrorSchema() },
      },
      description: '未授权',
    },
  },
})

export type ProtectedRouteContext = HandlerContextFor<typeof jwtProtectedRoute, 'get'>

/** 双 Token 响应（登录 / 刷新共用） */
const AdminTokenPairSchema = z.object({
  token: z.string().openapi({ description: 'Access Token (JWT, 短命)' }),
  refreshToken: z.string().openapi({ description: 'Refresh Token (长命, 用于续期)' }),
  tokenType: z.literal('Bearer').openapi({ description: '令牌类型，固定为 Bearer' }),
  expiresIn: z.number().openapi({ description: 'Access Token 有效期（秒）' }),
})

export const adminLoginRoute = createRoute({
  method: 'post',
  path: '/auth/jwt/login',
  tags: ['Auth'],
  summary: '管理员登录（邮箱+密码）',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminLoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '登录成功',
      content: {
        'application/json': {
          schema: createSuccessSchema(AdminTokenPairSchema),
        },
      },
    },
  },
})

export const adminRefreshRoute = createRoute({
  method: 'post',
  path: '/auth/jwt/refresh',
  tags: ['Auth'],
  summary: '刷新 Access Token（Refresh Token 旋转）',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminRefreshTokenSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '刷新成功',
      content: {
        'application/json': {
          schema: createSuccessSchema(AdminTokenPairSchema),
        },
      },
    },
  },
})

export const adminLogoutRoute = createRoute({
  method: 'post',
  path: '/auth/jwt/logout',
  tags: ['Auth'],
  summary: '登出（吊销 Refresh Token）',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AdminLogoutSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '登出成功',
      content: {
        'application/json': {
          schema: createSuccessSchema(z.null()),
        },
      },
    },
  },
})

export const authApi = {
  login: adminLoginRoute,
  refresh: adminRefreshRoute,
  logout: adminLogoutRoute,
  jwtProtected: jwtProtectedRoute,
}
