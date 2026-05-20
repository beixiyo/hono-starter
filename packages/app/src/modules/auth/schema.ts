import { z } from '@hono/zod-openapi'

export const LoginResponseSchema = z.object({
  token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1Ni...' }),
}).openapi('LoginResponse')

export const MessageSchema = z.object({
  message: z.string().openapi({ example: '成功' }),
  user: z.string().optional().openapi({ example: 'user123' }),
}).openapi('MessageResponse')

export const ProfileSchema = z.object({
  profile: z.object({
    userId: z.string(),
    name: z.string(),
  }),
}).openapi('ProfileResponse')

/**
 * 后台管理员登录请求体
 */
export const AdminLoginSchema = z.object({
  email: z.string().email().openapi({ description: '管理员登录邮箱' }),
  password: z.string().min(1).openapi({ description: '登录密码' }),
})

/**
 * 刷新 Token 请求体
 */
export const AdminRefreshTokenSchema = z.object({
  refreshToken: z.string().min(1).openapi({ description: 'Refresh Token' }),
})

/**
 * 登出请求体
 */
export const AdminLogoutSchema = z.object({
  refreshToken: z.string().min(1).openapi({ description: '当前使用的 Refresh Token' }),
})
