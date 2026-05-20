// ─────────────────────────────────────────────────────────────────────────────
/** 核心枚举 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 页面级权限级别，决定账号对某个资源页面的访问与操作范围。
 *
 * | 级别     | 含义                                               |
 * |----------|----------------------------------------------------|
 * | `none`   | 无权限，页面不可见，直接访问返回 403               |
 * | `view`   | 仅查看，可列表/详情查询，不可写                    |
 * | `edit`   | 常规写操作（新增、编辑、状态修改），不可高危/导出  |
 * | `manage` | 页面内全部操作（含导出/高危），高危仍需二次验证    |
 *
 * @default 'none'
 */
export type PermissionLevel = 'none' | 'view' | 'edit' | 'manage'

/**
 * 操作级权限，描述具体动作所需的最低页面权限级别。
 *
 * | 操作级别       | 最低要求页面权限       | 示例                           |
 * |----------------|------------------------|--------------------------------|
 * | `read`         | view                   | 列表查询、详情查询             |
 * | `write`        | edit                   | 新增、编辑、状态修改           |
 * | `export`       | manage                 | CSV/Excel 导出                 |
 * | `high_risk`    | manage（+ 二次验证）   | 取消订阅、设备解绑、批量作废   |
 * | `account_admin`| manage（仅账号管理页） | 账号创建、权限变更、禁用、删除 |
 */
export type ActionLevel = 'read' | 'write' | 'export' | 'high_risk' | 'account_admin'

/**
 * 资源 ID，与前端路由、PRD 页面一一对应。
 *
 * | 资源 ID              | PRD 页面       | 前端路由           |
 * |----------------------|----------------|--------------------|
 * | `analyse.dashboard`  | 经营看板       | `/analyse`         |
 * | `admin.users`        | 用户权益管理   | `/admin/users`     |
 * | `admin.codes`        | 兑换码管理     | `/admin/codes`     |
 * | `admin.feedback`     | 用户反馈管理   | `/admin/feedback`  |
 * | `admin.balance`      | 余额监控       | `/admin/balance`   |
 * | `admin.audit`        | 审计日志       | `/admin/audit`     |
 * | `admin.accounts`     | 管理员账号管理 | `/admin/accounts`  |
 */
export type ResourceId
  = | 'analyse.dashboard'
    | 'admin.users'
    | 'admin.codes'
    | 'admin.feedback'
    | 'admin.balance'
    | 'admin.audit'
    | 'admin.accounts'

/**
 * 账号权限映射：资源 ID → 权限级别。
 * 直接存储在 `admin_accounts.permissions` 字段中（SQLite 下为 JSON 文本）。
 * 未在映射内的资源视为 `'none'`。
 */
export type AccountPermissions = Partial<Record<ResourceId, PermissionLevel>>

/**
 * 预设权限模板名称（字面量枚举）。
 *
 * | 名称         | 含义                                     |
 * |--------------|------------------------------------------|
 * | `full`       | 全权限：所有资源 manage                  |
 * | `operations` | 运营管理：除账号管理外全部 manage        |
 * | `editor`     | 编辑者：业务资源 edit / 审计 view        |
 * | `readonly`   | 只读：所有业务资源 view                  |
 */
export type PermissionTemplateName = 'full' | 'operations' | 'editor' | 'readonly'

/** 权限模板条目 */
export interface PermissionTemplate {
  name: PermissionTemplateName
  permissions: AccountPermissions
}

// ─────────────────────────────────────────────────────────────────────────────
/** 高危动作策略 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 高危动作 ID，格式为 `{resource}:{action}`。
 *
 * | 动作 ID                            | 描述           | 确认词  |
 * |------------------------------------|----------------|---------|
 * | `admin.users:cancel_subscription`  | 取消用户订阅   | REVOKE  |
 * | `admin.users:unbind_device`        | 解绑用户设备   | -       |
 * | `admin.codes:revoke_single`        | 作废单个兑换码 | -       |
 * | `admin.codes:revoke_batch`         | 批量作废兑换码 | 批次名  |
 */
export type HighRiskActionId
  = | 'admin.users:cancel_subscription'
    | 'admin.users:unbind_device'
    | 'admin.codes:revoke_single'
    | 'admin.codes:revoke_batch'

/**
 * 高危动作策略，描述某个高危动作的执行前置条件。
 *
 * 与静态角色白名单不同，此处通过 `requiredPermission`（资源 + 最低权限级别）
 * 约束动作执行者，使得权限判定完全由账号独立的 `AccountPermissions` 决定。
 */
export interface HighRiskPolicy {
  /** 执行该动作所需的资源权限（资源 + 最低权限级别） */
  requiredPermission: { resource: ResourceId, level: PermissionLevel }
  /** 是否要求二次密码验证 */
  requirePassword: boolean
  /**
   * 确认词要求。
   * - `false`：不需要确认词
   * - `true`：需要，具体值由调用方动态传入（如批量作废时传批次名）
   * - `string`：需要，且确认词固定为该字符串（如 `'REVOKE'`）
   */
  confirmWord: false | true | string
  /** 审计日志展示的动作描述 */
  description: string
}

// ─────────────────────────────────────────────────────────────────────────────
/** 运行时身份与结果类型 */
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 登录管理员的身份信息，由 JWT 解析中间件写入请求上下文。
 * 不再携带 `role`——权限完全由 `AccountPermissions` 决定，从 DB 独立加载。
 */
export interface AdminIdentity {
  /** 管理员账号 ID */
  id: string
  /** 登录邮箱 */
  email: string
  /** 账号状态，`disabled` 时所有请求返回 401 */
  status: 'active' | 'disabled'
}

/**
 * 高危动作守卫所需的请求字段。
 *
 * 只包含 RBAC 层关心的**静态规则字段**，`password` / `reason` 等由业务层
 * 在 controller schema 中声明，不属于本模块的职责范围。
 *
 * @example
 * ```json
 * {
 *   "userId": "u_001",
 *   "confirmWord": "REVOKE"
 * }
 * ```
 */
export interface RiskGuardPayload {
  /**
   * 确认词，`policy.confirmWord !== false` 的动作必填。
   * 固定确认词动作传固定字符串；动态确认词动作（如批量作废）传批次名。
   */
  confirmWord?: string
}

/**
 * 权限快照，由 `GET /api/admin/me/permissions` 返回，
 * 前端用于控制导航可见性与按钮状态。
 */
export interface PermissionSnapshot {
  user: Pick<AdminIdentity, 'id' | 'email'>
  /** 各资源的权限级别，`none` 级别的资源不包含在内（前端据此控制导航可见性） */
  resources: Array<{
    resourceId: ResourceId
    level: Exclude<PermissionLevel, 'none'>
  }>
  /** 当前账号被明确拒绝的高危动作列表 */
  deniedActions: HighRiskActionId[]
}

// ─────────────────────────────────────────────────────────────────────────────
/** 鉴权结果 */
// ─────────────────────────────────────────────────────────────────────────────

/** 鉴权通过 */
export interface AuthAllowed {
  allowed: true
}

/** 鉴权拒绝，包含错误码与消息供 HTTP 响应和审计使用 */
export interface AuthDenied {
  allowed: false
  /** 机器可读错误码 */
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ACCOUNT_DISABLED' | 'HIGH_RISK_FAILED'
  /** 人类可读错误描述 */
  message: string
}

/** 鉴权结果联合类型 */
export type AuthResult = AuthAllowed | AuthDenied
