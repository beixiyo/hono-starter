import type { AccountPermissions, AdminIdentity } from '@/rbac/types'

export type AppEnv = {
  Variables: {
    requestId: string
    jwtPayload: {
      sub: string
      exp: number
      email?: string
      status?: 'active' | 'disabled'
    }
    identity: AdminIdentity | undefined
    accountPermissions: AccountPermissions | undefined
    parsedBody: Record<string, unknown> | undefined
  }
}
