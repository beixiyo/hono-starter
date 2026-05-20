import type { Context } from 'hono'
import type { z } from 'zod'
import type { ProtectedRouteContext } from './route'
import type { AdminLoginSchema, AdminLogoutSchema, AdminRefreshTokenSchema } from './schema'
import type { AdminIdentity } from '@/rbac'
import type { AppEnv } from '@/types'
import { Body, Controller, Context as Ctx, Inject } from 'di'
import { HTTPException } from 'hono/http-exception'
import { sign } from 'hono/jwt'
import {
  Get,
  Post,
} from '@/core'
import { JWT_CONFIG } from '@/core/constants'
import { RefreshTokenService } from './refresh-token.service'
import { adminLoginRoute, adminLogoutRoute, adminRefreshRoute, jwtProtectedRoute } from './route'
import { AuthService } from './service'

@Controller('/auth/jwt')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RefreshTokenService) private readonly refreshTokens: RefreshTokenService,
  ) { }

  /** 登录：返回 Access Token + Refresh Token */
  @Post('/login', adminLoginRoute)
  async login(@Body() _body: AdminLoginBody, @Ctx() _c: Context<AppEnv>) {
    const account = {
      id: 'mock-id',
      email: 'mock-email',
      status: 'active',
    }

    if (!account)
      throw new HTTPException(401, { message: '邮箱或密码错误，或账号已被禁用' })

    const accessToken = await this.signAccessToken(account)
    const refreshToken = await this.refreshTokens.create(account.id)

    return {
      token: accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: JWT_CONFIG.accessExpSeconds,
    }
  }

  /** 刷新 Token：验证 Refresh Token → 旋转 → 颁发新 Access + Refresh Token */
  @Post('/refresh', adminRefreshRoute)
  async refresh(@Body() body: AdminRefreshBody) {
    const result = await this.refreshTokens.rotateToken(body.refreshToken)
    if (!result)
      throw new HTTPException(401, { message: 'Refresh Token 无效或已过期，请重新登录' })

    /** 查询账号信息以签发新 Access Token */
    const account = {
      id: 'mock-id',
      email: 'mock-email',
      status: 'active',
    }
    if (!account || account.status !== 'active')
      throw new HTTPException(401, { message: '账号不存在或已被禁用' })

    const accessToken = await this.signAccessToken(account)

    return {
      token: accessToken,
      refreshToken: result.newRefreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: JWT_CONFIG.accessExpSeconds,
    }
  }

  /** 登出：吊销当前 Refresh Token */
  @Post('/logout', adminLogoutRoute)
  async logout(@Body() body: AdminLogoutBody) {
    await this.refreshTokens.revoke(body.refreshToken)
    return null
  }

  /** 签发 Access Token */
  private async signAccessToken(account: {
    id: string
    email: string
    status: string
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const exp = now + JWT_CONFIG.accessExpSeconds

    const identity: AdminIdentity = {
      id: account.id,
      email: account.email,
      status: account.status as AdminIdentity['status'],
    }

    return sign(
      {
        sub: identity.id,
        email: identity.email,
        status: identity.status,
        exp,
      },
      JWT_CONFIG.secret,
      'HS256',
    )
  }

  @Get('/protected', jwtProtectedRoute)
  async getProfile(c: ProtectedRouteContext) {
    const payload = c.get('jwtPayload')
    return { message: '通过 JWT 验证', user: payload.sub }
  }
}

type AdminLoginBody = z.infer<typeof AdminLoginSchema>
type AdminRefreshBody = z.infer<typeof AdminRefreshTokenSchema>
type AdminLogoutBody = z.infer<typeof AdminLogoutSchema>
