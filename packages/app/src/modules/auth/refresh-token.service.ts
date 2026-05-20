/**
 * Refresh Token 服务
 *
 * 职责：
 * - 创建 Refresh Token（SHA-256 哈希存储）
 * - 验证 + 旋转（rotation）：旧 Token 吊销，颁发新 Token
 * - 复用检测：已吊销 Token 被二次使用时，吊销该账号所有 Token
 * - 按账号吊销所有 Token（登出 / 安全事件）
 */
import type { PgDb } from '@/db/client'
import { Inject, Service } from 'di'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { JWT_CONFIG } from '@/core/constants'
import { PgDbToken } from '@/db/client'
import { adminRefreshTokens } from '@/db/schema'

@Service()
export class RefreshTokenService {
  constructor(
    @Inject(PgDbToken) private readonly db: PgDb,
  ) {}

  /**
   * 创建 Refresh Token
   *
   * @returns 明文 refreshToken（仅此时可见，后续只存 hash）
   */
  async create(accountId: string): Promise<string> {
    const rawToken = this.generateToken()
    const tokenHash = this.hash(rawToken)
    const expiresAt = new Date(Date.now() + JWT_CONFIG.refreshExpSeconds * 1000)

    await this.db
      .insert(adminRefreshTokens)
      .values({ accountId, tokenHash, expiresAt })

    return rawToken
  }

  /**
   * 验证 Refresh Token 并执行旋转
   *
   * 流程：
   * 1. 查找 Token 记录
   * 2. 若已吊销 → 复用攻击 → 吊销该账号所有 Token → 返回 null
   * 3. 若已过期 → 返回 null
   * 4. 吊销旧 Token，创建新 Token → 返回 { accountId, newRefreshToken }
   */
  async rotateToken(rawToken: string): Promise<RotateResult | null> {
    const tokenHash = this.hash(rawToken)

    const [record] = await this.db
      .select()
      .from(adminRefreshTokens)
      .where(eq(adminRefreshTokens.tokenHash, tokenHash))
      .limit(1)

    if (!record)
      return null

    /**
     * 旋转复用检测：该 Token 已在上一次 refresh 时被吊销并替换为新 Token，
     * 现在又被使用，说明 Token 泄露（攻击者拿旧 Token 重放）。
     * 安全措施：吊销该账号所有 Refresh Token，强制全部终端重新登录。
     */
    if (record.revokedAt) {
      await this.revokeAllByAccount(record.accountId)
      return null
    }

    /** 过期检测 */
    if (record.expiresAt < new Date())
      return null

    /** 创建新 Token */
    const newRawToken = this.generateToken()
    const newTokenHash = this.hash(newRawToken)
    const expiresAt = new Date(Date.now() + JWT_CONFIG.refreshExpSeconds * 1000)

    const [newRecord] = await this.db
      .insert(adminRefreshTokens)
      .values({ accountId: record.accountId, tokenHash: newTokenHash, expiresAt })
      .returning({ id: adminRefreshTokens.id })

    /** 吊销旧 Token，标记 replacedBy */
    await this.db
      .update(adminRefreshTokens)
      .set({ revokedAt: new Date(), replacedBy: newRecord!.id })
      .where(eq(adminRefreshTokens.id, record.id))

    return {
      accountId: record.accountId,
      newRefreshToken: newRawToken,
    }
  }

  /** 吊销单个 Refresh Token（登出时调用） */
  async revoke(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken)
    await this.db
      .update(adminRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminRefreshTokens.tokenHash, tokenHash),
          isNull(adminRefreshTokens.revokedAt),
        ),
      )
  }

  /** 吊销某账号的所有 Refresh Token（安全事件 / 密码修改） */
  async revokeAllByAccount(accountId: string): Promise<void> {
    await this.db
      .update(adminRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(adminRefreshTokens.accountId, accountId),
          isNull(adminRefreshTokens.revokedAt),
        ),
      )
  }

  /** 清理过期 Token 记录（定期调用） */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .delete(adminRefreshTokens)
      .where(lt(adminRefreshTokens.expiresAt, new Date()))
      .returning({ id: adminRefreshTokens.id })

    return result.length
  }

  /** 生成随机 Token（64 字节 hex = 128 字符） */
  private generateToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(64))
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  }

  /** SHA-256 哈希 */
  private hash(input: string): string {
    const hasher = new Bun.CryptoHasher('sha256')
    hasher.update(input)
    return hasher.digest('hex')
  }
}

type RotateResult = {
  accountId: string
  newRefreshToken: string
}
