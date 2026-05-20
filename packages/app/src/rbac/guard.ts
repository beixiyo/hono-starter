import type {
  AccountPermissions,
  ActionLevel,
  AdminIdentity,
  AuthResult,
  HighRiskActionId,
  PermissionLevel,
  PermissionSnapshot,
  ResourceId,
  RiskGuardPayload,
} from './types'
import {
  ACTION_REQUIRED_LEVEL,
  AUTH_ERROR_CODE,
  HIGH_RISK_POLICIES,
  PERMISSION_LEVEL_ORDER,
} from './constants'

// ─────────────────────────────────────────────────────────────────────────────
/** 基础查询 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 查询账号对某资源的页面权限级别
 *
 * @param permissions - 账号权限映射（通常来自 `admin_accounts.permissions`）
 * @param resourceId - 目标资源 ID
 * @returns 页面权限级别，未配置则返回 `'none'`
 *
 * @example
 * ```ts
 * getPermissionLevel({ 'admin.users': 'edit' }, 'admin.users') // 'edit'
 * getPermissionLevel({ 'admin.users': 'edit' }, 'admin.audit') // 'none'
 * ```
 */
export function getPermissionLevel(
  permissions: AccountPermissions,
  resourceId: ResourceId,
): PermissionLevel {
  return permissions[resourceId] ?? 'none'
}

/**
 * 判断账号对某资源是否满足指定操作级别的要求
 *
 * @param permissions - 账号权限映射
 * @param resourceId - 目标资源 ID
 * @param action - 所需操作级别
 *
 * @example
 * ```ts
 * hasActionPermission({ 'admin.codes': 'edit' }, 'admin.codes', 'export')  // false
 * hasActionPermission({ 'admin.codes': 'manage' }, 'admin.codes', 'export') // true
 * ```
 */
export function hasActionPermission(
  permissions: AccountPermissions,
  resourceId: ResourceId,
  action: ActionLevel,
): boolean {
  const actual = getPermissionLevel(permissions, resourceId)
  const required = ACTION_REQUIRED_LEVEL[action]
  return PERMISSION_LEVEL_ORDER[actual] >= PERMISSION_LEVEL_ORDER[required]
}

// ─────────────────────────────────────────────────────────────────────────────
/** 标准鉴权入口 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 页面/接口访问鉴权
 *
 * 执行顺序：账号状态 → 权限级别比较
 * 不包含高危二次验证，高危动作请额外调用 {@link checkHighRiskAction}
 *
 * @param identity - 已验证的管理员身份
 * @param permissions - 账号权限映射
 * @param resourceId - 目标资源 ID
 * @param action - 所需操作级别
 * @returns `AuthResult`，`allowed: false` 时包含错误码与消息
 *
 * @example
 * ```ts
 * const result = checkPermission(identity, permissions, 'admin.codes', 'write')
 * if (!result.allowed) return c.json({ code: result.code, message: result.message }, 403)
 * ```
 */
export function checkPermission(
  identity: AdminIdentity,
  permissions: AccountPermissions,
  resourceId: ResourceId,
  action: ActionLevel,
): AuthResult {
  if (identity.status === 'disabled') {
    return {
      allowed: false,
      code: AUTH_ERROR_CODE.ACCOUNT_DISABLED,
      message: `Account ${identity.email} has been disabled`,
    }
  }

  if (!hasActionPermission(permissions, resourceId, action)) {
    return {
      allowed: false,
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: `No permission for ${resourceId}:${action}`,
    }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────────────────────
/** 高危动作策略校验 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 高危动作执行前的策略校验
 *
 * 此函数只做：
 * 1. 权限级别校验（`requiredPermission`）
 * 2. 确认词格式校验（固定确认词直接比对；动态确认词只检查非空，业务层自行比对具体值）
 *
 * **密码正确性不在此处校验**，需由调用方额外执行 `verifyAdminPassword()`，
 * 密码验证失败时应写入 `result=Fail` 的审计日志
 *
 * @param permissions - 账号权限映射
 * @param actionId - 高危动作 ID
 * @param payload - 高危请求体
 * @returns `AuthResult`
 */
export function checkHighRiskAction(
  permissions: AccountPermissions,
  actionId: HighRiskActionId,
  payload: RiskGuardPayload,
): AuthResult {
  const policy = HIGH_RISK_POLICIES[actionId]

  const actual = getPermissionLevel(permissions, policy.requiredPermission.resource)
  const required = policy.requiredPermission.level
  if (PERMISSION_LEVEL_ORDER[actual] < PERMISSION_LEVEL_ORDER[required]) {
    return {
      allowed: false,
      code: AUTH_ERROR_CODE.FORBIDDEN,
      message: `Action ${actionId} requires ${required} on ${policy.requiredPermission.resource}, got ${actual}`,
    }
  }

  if (policy.confirmWord !== false) {
    if (!payload.confirmWord) {
      return {
        allowed: false,
        code: AUTH_ERROR_CODE.HIGH_RISK_FAILED,
        message: `confirmWord is required for action ${actionId}`,
      }
    }
    /** 固定确认词：直接比对 */
    if (typeof policy.confirmWord === 'string' && payload.confirmWord !== policy.confirmWord) {
      return {
        allowed: false,
        code: AUTH_ERROR_CODE.HIGH_RISK_FAILED,
        message: `confirmWord mismatch for action ${actionId} (expected "${policy.confirmWord}")`,
      }
    }
    /** 动态确认词（policy.confirmWord === true）：只检查非空，业务层负责比对具体值 */
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────────────────────
/** 权限快照计算 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 根据 identity 和 permissions 计算权限快照，供 `GET /api/admin/me/permissions` 接口返回
 *
 * - `none` 级别的资源不包含在 `resources` 中（前端据此控制导航可见性）
 * - 当前账号被拒绝的高危动作列入 `deniedActions`
 *
 * @param identity - 已验证的管理员身份
 * @param permissions - 账号权限映射
 */
export function buildPermissionSnapshot(
  identity: AdminIdentity,
  permissions: AccountPermissions,
): PermissionSnapshot {
  const allResourceIds = Object.keys(permissions) as ResourceId[]

  const resources = allResourceIds
    .map(resourceId => ({
      resourceId,
      level: getPermissionLevel(permissions, resourceId),
    }))
    .filter(r => r.level !== 'none') as Array<{
    resourceId: ResourceId
    level: Exclude<PermissionLevel, 'none'>
  }>

  const allActions = Object.keys(HIGH_RISK_POLICIES) as HighRiskActionId[]
  const deniedActions = allActions.filter((actionId) => {
    const policy = HIGH_RISK_POLICIES[actionId]
    const actual = getPermissionLevel(permissions, policy.requiredPermission.resource)
    return PERMISSION_LEVEL_ORDER[actual] < PERMISSION_LEVEL_ORDER[policy.requiredPermission.level]
  })

  return {
    user: { id: identity.id, email: identity.email },
    resources,
    deniedActions,
  }
}
