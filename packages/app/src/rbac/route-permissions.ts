/**
 * Admin 路由与 RBAC 权限映射
 *
 * 基于 PRD V2.6 § 3.1.2 页面权限矩阵，将 API 路径 + 方法映射到资源与操作级别。
 * 中间件根据当前请求查找匹配项并执行 checkPermission。
 */
import type { ActionLevel, ResourceId } from './types'

const LEADING_SLASHES_RE = /^\/+/

/** 匹配规则：method + path 模式（支持简单通配） */
export interface RoutePermissionRule {
  method: string
  /**
   * 路径匹配：精确或前缀。
   * - `/api/admin/users` 匹配 GET /api/admin/users
   * - `/api/admin/users/` 匹配 /api/admin/users/xxx 等子路径
   */
  pathPrefix: string
  resource: ResourceId
  action: ActionLevel
}

const RULES: RoutePermissionRule[] = [
  /** 权限快照（任意已认证用户可访问） */
  { method: 'get', pathPrefix: '/api/admin/me/permissions', resource: 'admin.users', action: 'read' },

  // ── admin.users ── 对齐 AdminBffController 实际路由
  { method: 'get', pathPrefix: '/api/admin/users', resource: 'admin.users', action: 'read' },
  { method: 'post', pathPrefix: '/api/admin/membership/gift', resource: 'admin.users', action: 'write' },
  { method: 'post', pathPrefix: '/api/admin/membership/revoke', resource: 'admin.users', action: 'high_risk' },
  { method: 'post', pathPrefix: '/api/admin/quota/update', resource: 'admin.users', action: 'write' },
  { method: 'post', pathPrefix: '/api/admin/device/upload_firmware', resource: 'admin.users', action: 'write' },
  { method: 'delete', pathPrefix: '/api/admin/device/', resource: 'admin.users', action: 'high_risk' },

  // ── admin.me（任意已认证用户可访问） ──
  { method: 'post', pathPrefix: '/api/admin/me/change-password', resource: 'admin.users', action: 'read' },
  { method: 'get', pathPrefix: '/api/admin/me/permissions', resource: 'admin.users', action: 'read' },
  { method: 'get', pathPrefix: '/api/admin/me/login-history', resource: 'admin.users', action: 'read' },
  { method: 'get', pathPrefix: '/api/admin/me', resource: 'admin.users', action: 'read' },

  // ── admin.accounts ──
  { method: 'get', pathPrefix: '/api/admin/accounts', resource: 'admin.accounts', action: 'account_admin' },
  { method: 'post', pathPrefix: '/api/admin/accounts', resource: 'admin.accounts', action: 'account_admin' },
  { method: 'patch', pathPrefix: '/api/admin/accounts/', resource: 'admin.accounts', action: 'account_admin' },
  { method: 'delete', pathPrefix: '/api/admin/accounts/', resource: 'admin.accounts', action: 'account_admin' },

  // ── admin.codes ── 对齐 AdminBffController（/admin/redemption）
  { method: 'get', pathPrefix: '/api/admin/redemption', resource: 'admin.codes', action: 'read' },
  { method: 'post', pathPrefix: '/api/admin/redemption/generate', resource: 'admin.codes', action: 'write' },
  { method: 'post', pathPrefix: '/api/admin/redemption/revoke', resource: 'admin.codes', action: 'high_risk' },

  // ── admin.audit ──
  { method: 'get', pathPrefix: '/api/admin/audit-logs/', resource: 'admin.audit', action: 'read' },
  { method: 'get', pathPrefix: '/api/admin/audit', resource: 'admin.audit', action: 'read' },

  // ── analyse.dashboard（经营看板） ──
  { method: 'get', pathPrefix: '/api/analyse/overview', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/stats', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/users/distribution', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/users/activity', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/users/top-cost', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/users/anomalies', resource: 'analyse.dashboard', action: 'read' },
  { method: 'get', pathPrefix: '/api/analyse/cost', resource: 'analyse.dashboard', action: 'read' },
  { method: 'post', pathPrefix: '/api/analyse/mock/events/insert', resource: 'analyse.dashboard', action: 'write' },
]

function normalizePath(path: string): string {
  return path.replace(LEADING_SLASHES_RE, '/')
}

/**
 * 根据请求 method + path 查找对应的权限规则。
 * 精确匹配优先，其次前缀匹配（取最长前缀）。
 */
export function findRoutePermission(method: string, path: string): { resource: ResourceId, action: ActionLevel } | null {
  const normalized = normalizePath(path)
  let best: RoutePermissionRule | null = null
  let bestLen = 0

  for (const rule of RULES) {
    if (rule.method.toLowerCase() !== method.toLowerCase())
      continue
    const prefix = normalizePath(rule.pathPrefix)
    /**
     * 当 pathPrefix 以 '/' 结尾时（如 '/api/admin/accounts/'），
     * 不再追加 '/'，避免生成 '//' 导致子路径无法匹配
     */
    const subPrefix = prefix.endsWith('/')
      ? prefix
      : `${prefix}/`
    if (normalized === prefix || normalized.startsWith(subPrefix)) {
      if (prefix.length > bestLen) {
        best = rule
        bestLen = prefix.length
      }
    }
  }

  return best
    ? { resource: best.resource, action: best.action }
    : null
}
