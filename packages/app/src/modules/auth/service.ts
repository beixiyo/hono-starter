import { Service } from 'di'
import { sign } from 'hono/jwt'
import { JWT_CONFIG } from '@/core'

@Service()
export class AuthService {
  async generateToken(userId: string) {
    return await sign(
      {
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + JWT_CONFIG.accessExpSeconds,
      },
      JWT_CONFIG.secret,
      'HS256',
    )
  }
}
