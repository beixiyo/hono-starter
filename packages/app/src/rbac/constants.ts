import type { HighRiskActionId, HighRiskPolicy, PermissionTemplate } from './types'

// ─────────────────────────────────────────────────────────────────────────────
/** 鉴权错误码 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 鉴权失败时的机器可读错误码
 */
export const AUTH_ERROR_CODE = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  FORBIDDEN: 'FORBIDDEN',
  HIGH_RISK_FAILED: 'HIGH_RISK_FAILED',
} as const

/** 鉴权错误码联合类型 */
export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE]

// ─────────────────────────────────────────────────────────────────────────────
/** 权限级别有序序列 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 权限级别数值映射，数值越大权限越高。
 * 用于大小比较：`实际级别 >= 要求级别` 时通过。
 */
export const PERMISSION_LEVEL_ORDER = {
  none: 0,
  view: 1,
  edit: 2,
  manage: 3,
} as const satisfies Record<string, number>

// ─────────────────────────────────────────────────────────────────────────────
/** 操作级别 -> 最低页面权限要求 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 各操作级别对应的最低页面权限要求。
 *
 * 鉴权逻辑：`PERMISSION_LEVEL_ORDER[actual] >= PERMISSION_LEVEL_ORDER[required]`
 */
export const ACTION_REQUIRED_LEVEL = {
  read: 'view',
  write: 'edit',
  export: 'manage',
  high_risk: 'manage',
  account_admin: 'manage',
} as const satisfies Record<string, string>

// ─────────────────────────────────────────────────────────────────────────────
/** 高危动作策略 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 高危动作策略表。
 *
 * 每个动作声明：所需资源权限、是否要求密码、是否要求确认词。
 * 在页面 `manage` 权限通过后，鉴权中间件额外执行此策略校验。
 *
 * `requiredPermission` 相比旧版角色白名单更精准：权限判定完全由账号独立的
 * `AccountPermissions` 决定，新增/调整账号时只改 DB，不再需要改代码部署。
 */
export const HIGH_RISK_POLICIES: Record<HighRiskActionId, HighRiskPolicy> = {
  'admin.users:cancel_subscription': {
    requiredPermission: { resource: 'admin.users', level: 'manage' },
    requirePassword: true,
    confirmWord: 'REVOKE',
    description: '取消用户订阅',
  },
  'admin.users:unbind_device': {
    requiredPermission: { resource: 'admin.users', level: 'manage' },
    requirePassword: true,
    confirmWord: false,
    description: '解绑用户设备',
  },
  'admin.codes:revoke_single': {
    requiredPermission: { resource: 'admin.codes', level: 'manage' },
    requirePassword: true,
    confirmWord: false,
    description: '作废单个兑换码',
  },
  'admin.codes:revoke_batch': {
    requiredPermission: { resource: 'admin.codes', level: 'manage' },
    requirePassword: true,
    confirmWord: true, // 动态：批次名由请求方传入，业务层负责比对
    description: '批量作废兑换码',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
/** 权限模板种子数据 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 预设权限模板，用于 DB seed 初始化账号时的常见权限组合。
 *
 * 调用方可以基于模板克隆一份 `AccountPermissions` 再按需调整，
 * 避免每次创建账号都手写完整映射。
 */
export const SEED_PERMISSION_TEMPLATES: readonly PermissionTemplate[] = [
  {
    name: 'full',
    permissions: {
      'analyse.dashboard': 'manage',
      'admin.users': 'manage',
      'admin.codes': 'manage',
      'admin.feedback': 'manage',
      'admin.balance': 'manage',
      'admin.audit': 'manage',
      'admin.accounts': 'manage',
    },
  },
  {
    name: 'operations',
    permissions: {
      'analyse.dashboard': 'manage',
      'admin.users': 'manage',
      'admin.codes': 'manage',
      'admin.feedback': 'manage',
      'admin.balance': 'manage',
      'admin.audit': 'manage',
      'admin.accounts': 'none',
    },
  },
  {
    name: 'editor',
    permissions: {
      'analyse.dashboard': 'view',
      'admin.users': 'edit',
      'admin.codes': 'edit',
      'admin.feedback': 'edit',
      'admin.balance': 'edit',
      'admin.audit': 'view',
      'admin.accounts': 'none',
    },
  },
  {
    name: 'readonly',
    permissions: {
      'analyse.dashboard': 'view',
      'admin.users': 'view',
      'admin.codes': 'view',
      'admin.feedback': 'view',
      'admin.balance': 'view',
      'admin.audit': 'none',
      'admin.accounts': 'none',
    },
  },
] as const
