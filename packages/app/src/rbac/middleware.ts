import type { Context, MiddlewareHandler } from 'hono'
import type {
  AccountPermissions,
  ActionLevel,
  HighRiskActionId,
  ResourceId,
  RiskGuardPayload,
} from './types'
import type { SqliteDb } from '@/db/client'
import type { AppEnv } from '@/types'
import { eq } from 'drizzle-orm'
import { adminAccounts } from '@/db/schema'
import { AUTH_ERROR_CODE, HIGH_RISK_POLICIES } from './constants'
import { checkHighRiskAction, checkPermission } from './guard'
import { findRoutePermission } from './route-permissions'

/**
 * 路由权限声明，注册路由时附加到 Hono 路由元数据上
 *
 * @example
 * ```ts
 * app.post(
 *   '/admin/users/:id/grant-member',
 *   requirePermission({ resource: 'admin.users', action: 'write' }),
 *   grantMemberHandler,
 * )
 * ```
 */
export interface RoutePermission {
  /** 目标资源 ID */
  resource: ResourceId
  /** 所需操作级别 */
  action: ActionLevel
}

/**
 * Hono 中间件工厂：声明式路由权限守卫
 *
 * 从请求上下文读取 `identity` + `accountPermissions`
 * （分别由 `identityMiddleware` 和 `createPermissionsMiddleware` 写入），
 * 调用 `checkPermission` 鉴权，失败时返回对应 HTTP 状态码 + `request_id`
 *
 * 执行顺序：
 * `identityMiddleware` → `createPermissionsMiddleware` →
 * `requirePermission` → (high_risk 路由) `requireHighRiskGuard` → handler
 *
 * @param permission - 路由所需的资源与操作级别
 */
export function requirePermission(permission: RoutePermission): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    const identity = c.get('identity')
    const requestId = c.get('requestId')

    if (!identity) {
      return c.json({ code: AUTH_ERROR_CODE.UNAUTHENTICATED, message: 'Not authenticated', request_id: requestId }, 401)
    }

    const permissions = c.get('accountPermissions')
    if (!permissions) {
      return c.json({ code: AUTH_ERROR_CODE.FORBIDDEN, message: 'Permissions not loaded', request_id: requestId }, 403)
    }

    const result = checkPermission(identity, permissions, permission.resource, permission.action)

    if (!result.allowed) {
      const status = result.code === AUTH_ERROR_CODE.ACCOUNT_DISABLED
        ? 401
        : 403
      return c.json({ code: result.code, message: result.message, request_id: requestId }, status)
    }

    await next()
  }
}

/**
 * Hono 中间件工厂：高危动作静态规则守卫。
 *
 * **只做两件事**：
 * 1. `requiredPermission`：校验账号对策略资源的权限级别
 * 2. `confirmWord`：校验请求体里的确认词（固定比对 / 动态仅检查非空）
 *
 * **不做密码校验**——密码正确性、审计日志属于业务层，交给 controller 自己编排
 * （参见 USAGE.md「四、高危动作密码校验」）。
 *
 * 约定请求体结构：业务字段 + **平铺的** `confirmWord`（仅当策略要求时存在）。
 *
 * @param actionId - 高危动作 ID
 */
export function requireHighRiskGuard(
  actionId: HighRiskActionId,
): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    const identity = c.get('identity')
    const requestId = c.get('requestId')

    if (!identity) {
      return c.json({ code: AUTH_ERROR_CODE.UNAUTHENTICATED, message: 'Not authenticated', request_id: requestId }, 401)
    }

    const permissions = c.get('accountPermissions')
    if (!permissions) {
      return c.json({ code: AUTH_ERROR_CODE.FORBIDDEN, message: 'Permissions not loaded', request_id: requestId }, 403)
    }

    /** 仅在策略要求 confirmWord 时才读取 body；否则完全跳过，不干扰业务层再次解析 */
    const policy = HIGH_RISK_POLICIES[actionId]
    let payload: RiskGuardPayload = {}

    if (policy.confirmWord !== false) {
      let body: Record<string, unknown>
      try {
        body = await c.req.json()
      }
      catch {
        return c.json({ code: AUTH_ERROR_CODE.HIGH_RISK_FAILED, message: 'Request body is required', request_id: requestId }, 400)
      }
      payload = { confirmWord: body.confirmWord as string | undefined }
      /** 缓存 body，handler 可直接读取，避免 hono body 二次消费限制 */
      c.set('parsedBody', body)
    }

    const result = checkHighRiskAction(permissions, actionId, payload)

    if (!result.allowed) {
      const status = result.code === AUTH_ERROR_CODE.HIGH_RISK_FAILED
        ? 400
        : 403
      return c.json({ code: result.code, message: result.message, request_id: requestId }, status)
    }

    await next()
  }
}

/**
 * Hono 中间件：将 JWT payload 转换为 `AdminIdentity` 并写入上下文
 *
 * 必须在 JWT 验证中间件之后、`createPermissionsMiddleware` 之前挂载
 * JWT payload 中需含 `sub`、`email`、`status` 字段（`role` 已弃用）
 *
 * @example
 * ```ts
 * app.use('/api/admin/*', jwtMiddleware, identityMiddleware, createPermissionsMiddleware(db))
 * ```
 */
export const identityMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const payload = c.get('jwtPayload')

  if (payload) {
    c.set('identity', {
      id: payload.sub,
      email: payload.email ?? '',
      status: payload.status ?? 'active',
    } as const)
  }

  await next()
}

/**
 * 创建权限加载中间件：从 DB 查询账号的 `permissions` 字段并写入上下文
 *
 * 必须在 `identityMiddleware` 之后、`adminPermissionMiddleware` / `requirePermission` 之前挂载
 * 查不到账号时不写入 `accountPermissions`，后续守卫会返回 403
 *
 * @param db - Drizzle SQLite 数据库实例
 *
 * @example
 * ```ts
 * const db = createSqliteDb()
 * app.use('/api/admin/*', identityMiddleware)
 * app.use('/api/admin/*', createPermissionsMiddleware(db))
 * app.use('/api/admin/*', adminPermissionMiddleware)
 * ```
 */
export function createPermissionsMiddleware(db: SqliteDb): MiddlewareHandler<AppEnv> {
  return async (c: Context<AppEnv>, next) => {
    const identity = c.get('identity')

    if (identity) {
      const [row] = await db
        .select({ permissions: adminAccounts.permissions })
        .from(adminAccounts)
        .where(eq(adminAccounts.id, identity.id))
        .limit(1)

      if (row) {
        c.set('accountPermissions', row.permissions as AccountPermissions)
      }
    }

    await next()
  }
}

/**
 * Hono 中间件：根据路由映射执行 RBAC 权限校验
 *
 * 在 `createPermissionsMiddleware` 之后挂载，从 route-permissions 查找当前 method+path 对应的资源与操作，
 * 若找到则调用 `checkPermission`，未找到则放行（供未登记路由兼容）
 *
 * 仅对 `/api/admin/*` 生效，由调用方在 app.use 时限定路径
 */
export const adminPermissionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const identity = c.get('identity')
  const requestId = c.get('requestId')

  if (!identity) {
    return c.json({ code: AUTH_ERROR_CODE.UNAUTHENTICATED, message: 'Not authenticated', request_id: requestId }, 401)
  }

  const perm = findRoutePermission(c.req.method, c.req.path)
  if (!perm) {
    await next()
    return
  }

  const permissions = c.get('accountPermissions')
  if (!permissions) {
    return c.json({ code: AUTH_ERROR_CODE.FORBIDDEN, message: 'Permissions not loaded', request_id: requestId }, 403)
  }

  const result = checkPermission(identity, permissions, perm.resource, perm.action)

  if (!result.allowed) {
    const status = result.code === AUTH_ERROR_CODE.ACCOUNT_DISABLED
      ? 401
      : 403
    return c.json({ code: result.code, message: result.message, request_id: requestId }, status)
  }

  await next()
}
