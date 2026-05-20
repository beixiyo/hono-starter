import type { AccountPermissions, AdminIdentity, ResourceId } from './types'
import type { SqliteDb } from '@/db/client'
import type { AppEnv } from '@/types'
import { Database } from 'bun:sqlite'
import { beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Hono } from 'hono'
import { adminAccounts } from '@/db/schema'
import {
  ACTION_REQUIRED_LEVEL,
  AUTH_ERROR_CODE,
  HIGH_RISK_POLICIES,
  PERMISSION_LEVEL_ORDER,
  SEED_PERMISSION_TEMPLATES,
} from './constants'
import {
  buildPermissionSnapshot,
  checkHighRiskAction,
  checkPermission,
  getPermissionLevel,
  hasActionPermission,
} from './guard'
import {
  adminPermissionMiddleware,
  createPermissionsMiddleware,
  requireHighRiskGuard,
  requirePermission,
} from './middleware'

// ─── 测试工具 ──────────────────────────────────────────────────────────────────

function makeIdentity(overrides: Partial<AdminIdentity> = {}): AdminIdentity {
  return {
    id: 'test-id',
    email: 'test@example.com',
    status: 'active',
    ...overrides,
  }
}

/** 全权限 manage，用作对照组 */
const FULL_PERMISSIONS: AccountPermissions = {
  'analyse.dashboard': 'manage',
  'admin.users': 'manage',
  'admin.codes': 'manage',
  'admin.feedback': 'manage',
  'admin.balance': 'manage',
  'admin.audit': 'manage',
  'admin.accounts': 'manage',
}

/** 编辑者模板复用 SEED 常量 */
const EDITOR_PERMISSIONS
  = SEED_PERMISSION_TEMPLATES.find(t => t.name === 'editor')!.permissions

/** 只读模板复用 SEED 常量 */
const VIEWER_PERMISSIONS
  = SEED_PERMISSION_TEMPLATES.find(t => t.name === 'readonly')!.permissions

// ─── 1. 常量完整性 ─────────────────────────────────────────────────────────────

describe('常量完整性', () => {
  test('PERMISSION_LEVEL_ORDER 数值单调递增', () => {
    expect(PERMISSION_LEVEL_ORDER.none).toBeLessThan(PERMISSION_LEVEL_ORDER.view)
    expect(PERMISSION_LEVEL_ORDER.view).toBeLessThan(PERMISSION_LEVEL_ORDER.edit)
    expect(PERMISSION_LEVEL_ORDER.edit).toBeLessThan(PERMISSION_LEVEL_ORDER.manage)
  })

  test('ACTION_REQUIRED_LEVEL 覆盖所有操作级别', () => {
    const actions = ['read', 'write', 'export', 'high_risk', 'account_admin']
    for (const action of actions) {
      expect(ACTION_REQUIRED_LEVEL).toHaveProperty(action)
    }
  })

  test('HIGH_RISK_POLICIES 每条策略都有 requiredPermission', () => {
    for (const [, policy] of Object.entries(HIGH_RISK_POLICIES)) {
      expect(policy.requiredPermission).toBeDefined()
      expect(policy.requiredPermission.resource).toBeDefined()
      expect(policy.requiredPermission.level).toBeDefined()
      expect(typeof policy.description).toBe('string')
    }
  })

  test('SEED_PERMISSION_TEMPLATES 预设 4 个模板', () => {
    expect(SEED_PERMISSION_TEMPLATES).toHaveLength(4)
    expect(SEED_PERMISSION_TEMPLATES.map(t => t.name)).toEqual([
      'full',
      'operations',
      'editor',
      'readonly',
    ])
  })
})

// ─── 2. getPermissionLevel ────────────────────────────────────────────────────

describe('getPermissionLevel', () => {
  test('返回映射中的级别', () => {
    expect(getPermissionLevel({ 'admin.users': 'edit' }, 'admin.users')).toBe('edit')
  })

  test('未配置资源返回 none', () => {
    expect(getPermissionLevel({}, 'admin.users')).toBe('none')
  })

  test('全权限对所有资源均为 manage', () => {
    const resources: ResourceId[] = [
      'analyse.dashboard',
      'admin.users',
      'admin.codes',
      'admin.feedback',
      'admin.balance',
      'admin.audit',
      'admin.accounts',
    ]
    for (const r of resources) {
      expect(getPermissionLevel(FULL_PERMISSIONS, r)).toBe('manage')
    }
  })

  test('编辑者模板 admin.users 为 edit、admin.accounts 为 none', () => {
    expect(getPermissionLevel(EDITOR_PERMISSIONS, 'admin.users')).toBe('edit')
    expect(getPermissionLevel(EDITOR_PERMISSIONS, 'admin.accounts')).toBe('none')
  })
})

// ─── 3. hasActionPermission ───────────────────────────────────────────────────

describe('hasActionPermission', () => {
  test('viewer 可以 read admin.users', () => {
    expect(hasActionPermission(VIEWER_PERMISSIONS, 'admin.users', 'read')).toBe(true)
  })

  test('viewer 不可以 write admin.users', () => {
    expect(hasActionPermission(VIEWER_PERMISSIONS, 'admin.users', 'write')).toBe(false)
  })

  test('editor 可以 write admin.users', () => {
    expect(hasActionPermission(EDITOR_PERMISSIONS, 'admin.users', 'write')).toBe(true)
  })

  test('editor 不可以 export admin.codes', () => {
    expect(hasActionPermission(EDITOR_PERMISSIONS, 'admin.codes', 'export')).toBe(false)
  })

  test('全权限可以 export admin.codes', () => {
    expect(hasActionPermission(FULL_PERMISSIONS, 'admin.codes', 'export')).toBe(true)
  })

  test('全权限可以 high_risk admin.codes', () => {
    expect(hasActionPermission(FULL_PERMISSIONS, 'admin.codes', 'high_risk')).toBe(true)
  })

  test('空权限映射所有操作都不允许', () => {
    expect(hasActionPermission({}, 'admin.users', 'read')).toBe(false)
    expect(hasActionPermission({}, 'admin.accounts', 'account_admin')).toBe(false)
  })
})

// ─── 4. checkPermission ───────────────────────────────────────────────────────

describe('checkPermission', () => {
  test('正常鉴权通过', () => {
    const result = checkPermission(makeIdentity(), FULL_PERMISSIONS, 'admin.users', 'write')
    expect(result.allowed).toBe(true)
  })

  test('disabled 账号返回 ACCOUNT_DISABLED', () => {
    const result = checkPermission(
      makeIdentity({ status: 'disabled' }),
      FULL_PERMISSIONS,
      'admin.users',
      'read',
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe(AUTH_ERROR_CODE.ACCOUNT_DISABLED)
    }
  })

  test('权限不足返回 FORBIDDEN', () => {
    const result = checkPermission(makeIdentity(), EDITOR_PERMISSIONS, 'admin.codes', 'export')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe(AUTH_ERROR_CODE.FORBIDDEN)
      expect(result.message).toContain('admin.codes:export')
    }
  })

  test('viewer 访问 admin.audit 返回 FORBIDDEN（模板中 none）', () => {
    const result = checkPermission(makeIdentity(), VIEWER_PERMISSIONS, 'admin.audit', 'read')
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe(AUTH_ERROR_CODE.FORBIDDEN)
    }
  })

  test('disabled 优先级高于权限不足', () => {
    const result = checkPermission(
      makeIdentity({ status: 'disabled' }),
      {},
      'admin.accounts',
      'account_admin',
    )
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.code).toBe(AUTH_ERROR_CODE.ACCOUNT_DISABLED)
    }
  })
})

// ─── 5. checkHighRiskAction ───────────────────────────────────────────────────

describe('checkHighRiskAction', () => {
  describe('cancel_subscription（要求 admin.users manage + 固定确认词 REVOKE）', () => {
    test('manage 权限 + 正确确认词 → 通过', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.users:cancel_subscription',
        { confirmWord: 'REVOKE' },
      )
      expect(result.allowed).toBe(true)
    })

    test('仅 edit 权限被拒绝（requiredPermission）', () => {
      const result = checkHighRiskAction(
        EDITOR_PERMISSIONS,
        'admin.users:cancel_subscription',
        { confirmWord: 'REVOKE' },
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe(AUTH_ERROR_CODE.FORBIDDEN)
        expect(result.message).toContain('manage')
      }
    })

    test('manage 权限 + 错误确认词 → HIGH_RISK_FAILED', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.users:cancel_subscription',
        { confirmWord: 'WRONG' },
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe(AUTH_ERROR_CODE.HIGH_RISK_FAILED)
        expect(result.message).toContain('REVOKE')
      }
    })

    test('manage 权限 + 缺少确认词 → HIGH_RISK_FAILED', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.users:cancel_subscription',
        {},
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe(AUTH_ERROR_CODE.HIGH_RISK_FAILED)
      }
    })
  })

  describe('unbind_device（manage + 无确认词）', () => {
    test('manage → 通过', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.users:unbind_device',
        {},
      )
      expect(result.allowed).toBe(true)
    })

    test('edit 被拒绝', () => {
      const result = checkHighRiskAction(
        EDITOR_PERMISSIONS,
        'admin.users:unbind_device',
        {},
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe(AUTH_ERROR_CODE.FORBIDDEN)
      }
    })
  })

  describe('revoke_batch（manage + 动态确认词）', () => {
    test('manage 权限 + 传入确认词 → 通过（业务层自行比对批次名）', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.codes:revoke_batch',
        { confirmWord: 'batch-2025-03' },
      )
      expect(result.allowed).toBe(true)
    })

    test('manage 权限 + 未传确认词 → HIGH_RISK_FAILED', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.codes:revoke_batch',
        {},
      )
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.code).toBe(AUTH_ERROR_CODE.HIGH_RISK_FAILED)
      }
    })

    test('只读权限被拒绝', () => {
      const result = checkHighRiskAction(
        VIEWER_PERMISSIONS,
        'admin.codes:revoke_batch',
        { confirmWord: 'batch-2025-03' },
      )
      expect(result.allowed).toBe(false)
    })
  })

  describe('revoke_single（manage + 无确认词）', () => {
    test('manage → 通过', () => {
      const result = checkHighRiskAction(
        FULL_PERMISSIONS,
        'admin.codes:revoke_single',
        {},
      )
      expect(result.allowed).toBe(true)
    })

    test('edit 被拒绝', () => {
      const result = checkHighRiskAction(
        EDITOR_PERMISSIONS,
        'admin.codes:revoke_single',
        {},
      )
      expect(result.allowed).toBe(false)
    })
  })
})

// ─── 6. buildPermissionSnapshot ──────────────────────────────────────────────

describe('buildPermissionSnapshot', () => {
  test('全权限快照包含所有 7 个资源', () => {
    const snapshot = buildPermissionSnapshot(makeIdentity(), FULL_PERMISSIONS)
    expect(snapshot.resources).toHaveLength(7)
    expect(snapshot.resources.every(r => r.level === 'manage')).toBe(true)
  })

  test('运营管理快照不包含 admin.accounts（none 级别不返回）', () => {
    const ops = SEED_PERMISSION_TEMPLATES.find(t => t.name === 'operations')!.permissions
    const snapshot = buildPermissionSnapshot(makeIdentity(), ops)
    const accountsEntry = snapshot.resources.find(r => r.resourceId === 'admin.accounts')
    expect(accountsEntry).toBeUndefined()
    expect(snapshot.resources).toHaveLength(6)
  })

  test('只读快照不包含 admin.audit 和 admin.accounts', () => {
    const snapshot = buildPermissionSnapshot(makeIdentity(), VIEWER_PERMISSIONS)
    const excluded = snapshot.resources.filter(
      r => r.resourceId === 'admin.audit' || r.resourceId === 'admin.accounts',
    )
    expect(excluded).toHaveLength(0)
  })

  test('全权限 deniedActions 为空', () => {
    const snapshot = buildPermissionSnapshot(makeIdentity(), FULL_PERMISSIONS)
    expect(snapshot.deniedActions).toHaveLength(0)
  })

  test('编辑者 deniedActions 包含所有高危动作（均要求 manage）', () => {
    const snapshot = buildPermissionSnapshot(makeIdentity(), EDITOR_PERMISSIONS)
    const allActions = Object.keys(HIGH_RISK_POLICIES)
    expect(snapshot.deniedActions).toHaveLength(allActions.length)
  })

  test('只读 deniedActions 包含所有高危动作', () => {
    const snapshot = buildPermissionSnapshot(makeIdentity(), VIEWER_PERMISSIONS)
    const allActions = Object.keys(HIGH_RISK_POLICIES)
    expect(snapshot.deniedActions).toHaveLength(allActions.length)
  })

  test('快照 user 字段仅包含 id 与 email（不含 role）', () => {
    const identity = makeIdentity({ email: 'editor@test.com', id: 'e-001' })
    const snapshot = buildPermissionSnapshot(identity, EDITOR_PERMISSIONS)
    expect(snapshot.user.id).toBe('e-001')
    expect(snapshot.user.email).toBe('editor@test.com')
    expect(snapshot.user).not.toHaveProperty('role')
  })
})

// ─── 7. 集成测试：in-memory SQLite + middleware 全链路 ─────────────────────────

/**
 * 创建一个内存 SQLite DB 并建表、种入指定账号。
 * 建表语句需与 `adminAccounts` schema 保持一致；drizzle-kit 迁移走 Postgres 所以这里手写。
 */
function createTestDb(): SqliteDb {
  const sqlite = new Database(':memory:')
  sqlite.run(`
    CREATE TABLE admin_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      permissions TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)
  return drizzle(sqlite)
}

/** 种入一个账号 */
async function seedAccount(
  db: SqliteDb,
  account: {
    id: string
    email: string
    permissions: AccountPermissions
    status?: 'active' | 'disabled'
  },
) {
  await db.insert(adminAccounts).values({
    id: account.id,
    email: account.email,
    passwordHash: 'fake-hash',
    status: account.status ?? 'active',
    permissions: account.permissions,
  })
}

/**
 * 构建测试专用 Hono app：
 * 不跑真实 JWT，直接按 `X-Test-Account-Id` 头部加载 identity；
 * 然后串接 createPermissionsMiddleware，供后续守卫消费。
 */
function buildTestApp(db: SqliteDb) {
  const app = new Hono<AppEnv>()

  /** 伪造 identityMiddleware：读取测试头填充 identity */
  app.use('*', async (c, next) => {
    c.set('requestId', 'req-test')
    const accountId = c.req.header('X-Test-Account-Id')
    const status = (c.req.header('X-Test-Account-Status') ?? 'active') as 'active' | 'disabled'
    if (accountId) {
      c.set('identity', { id: accountId, email: `${accountId}@test.com`, status })
    }
    await next()
  })

  app.use('*', createPermissionsMiddleware(db))

  /** 按路由方式：显式声明权限 */
  app.get(
    '/codes',
    requirePermission({ resource: 'admin.codes', action: 'read' }),
    c => c.json({ ok: true }),
  )
  app.post(
    '/codes/export',
    requirePermission({ resource: 'admin.codes', action: 'export' }),
    c => c.json({ ok: true }),
  )
  /** revoke_single：policy.confirmWord === false，中间件不读 body */
  app.post(
    '/codes/revoke',
    requirePermission({ resource: 'admin.codes', action: 'high_risk' }),
    requireHighRiskGuard('admin.codes:revoke_single'),
    c => c.json({ ok: true }),
  )

  /** revoke_batch：policy.confirmWord === true，中间件要求 body.confirmWord 非空 */
  app.post(
    '/codes/revoke-batch',
    requirePermission({ resource: 'admin.codes', action: 'high_risk' }),
    requireHighRiskGuard('admin.codes:revoke_batch'),
    c => c.json({ ok: true }),
  )

  /** 全局方式：adminPermissionMiddleware 用 route-permissions 的 RULES 自动匹配 */
  app.use('/api/admin/*', adminPermissionMiddleware)
  app.get('/api/admin/redemption', c => c.json({ ok: true }))
  app.post('/api/admin/redemption/generate', c => c.json({ ok: true }))

  return app
}

describe('中间件集成测试（内存 SQLite）', () => {
  let db: SqliteDb
  let app: ReturnType<typeof buildTestApp>

  beforeEach(async () => {
    db = createTestDb()
    /** 3 类账号：全权限、编辑者、只读 */
    await seedAccount(db, {
      id: 'u-admin',
      email: 'admin@test.com',
      permissions: FULL_PERMISSIONS,
    })
    await seedAccount(db, {
      id: 'u-editor',
      email: 'editor@test.com',
      permissions: EDITOR_PERMISSIONS,
    })
    await seedAccount(db, {
      id: 'u-viewer',
      email: 'viewer@test.com',
      permissions: VIEWER_PERMISSIONS,
    })
    await seedAccount(db, {
      id: 'u-disabled',
      email: 'disabled@test.com',
      permissions: FULL_PERMISSIONS,
      status: 'disabled',
    })
    app = buildTestApp(db)
  })

  test('requirePermission：viewer 可 read /codes', async () => {
    const res = await app.request('/codes', {
      headers: { 'X-Test-Account-Id': 'u-viewer' },
    })
    expect(res.status).toBe(200)
  })

  test('requirePermission：editor 不能 export /codes/export（403 FORBIDDEN）', async () => {
    const res = await app.request('/codes/export', {
      method: 'POST',
      headers: { 'X-Test-Account-Id': 'u-editor' },
    })
    expect(res.status).toBe(403)
    const body = await res.json() as { code: string }
    expect(body.code).toBe(AUTH_ERROR_CODE.FORBIDDEN)
  })

  test('requirePermission：admin 可 export /codes/export', async () => {
    const res = await app.request('/codes/export', {
      method: 'POST',
      headers: { 'X-Test-Account-Id': 'u-admin' },
    })
    expect(res.status).toBe(200)
  })

  test('未携带测试头 → 401 UNAUTHENTICATED', async () => {
    const res = await app.request('/codes')
    expect(res.status).toBe(401)
    const body = await res.json() as { code: string }
    expect(body.code).toBe(AUTH_ERROR_CODE.UNAUTHENTICATED)
  })

  test('disabled 账号 → 401 ACCOUNT_DISABLED', async () => {
    const res = await app.request('/codes', {
      headers: {
        'X-Test-Account-Id': 'u-disabled',
        'X-Test-Account-Status': 'disabled',
      },
    })
    expect(res.status).toBe(401)
    const body = await res.json() as { code: string }
    expect(body.code).toBe(AUTH_ERROR_CODE.ACCOUNT_DISABLED)
  })

  test('DB 中不存在的账号 → 403 Permissions not loaded', async () => {
    const res = await app.request('/codes', {
      headers: { 'X-Test-Account-Id': 'u-ghost' },
    })
    expect(res.status).toBe(403)
  })

  test('requireHighRiskGuard（revoke_single，无确认词）：admin → 200，中间件不碰 body', async () => {
    const res = await app.request('/codes/revoke', {
      method: 'POST',
      headers: {
        'X-Test-Account-Id': 'u-admin',
        'Content-Type': 'application/json',
      },
      /** 平铺 body，业务字段任意；中间件不要求任何字段 */
      body: JSON.stringify({ codeId: 'c1' }),
    })
    expect(res.status).toBe(200)
  })

  test('requireHighRiskGuard：editor（无 manage 权限）→ 403 FORBIDDEN', async () => {
    const res = await app.request('/codes/revoke', {
      method: 'POST',
      headers: {
        'X-Test-Account-Id': 'u-editor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codeId: 'c1' }),
    })
    /** requirePermission 先行拦截，因为 editor 对 codes 只有 edit < manage */
    expect(res.status).toBe(403)
  })

  test('requireHighRiskGuard（revoke_batch，动态确认词）：传入 confirmWord → 200', async () => {
    const res = await app.request('/codes/revoke-batch', {
      method: 'POST',
      headers: {
        'X-Test-Account-Id': 'u-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codeIds: [1, 2, 3], confirmWord: 'batch-2025-03' }),
    })
    expect(res.status).toBe(200)
  })

  test('requireHighRiskGuard（revoke_batch）：缺少 confirmWord → 400 HIGH_RISK_FAILED', async () => {
    const res = await app.request('/codes/revoke-batch', {
      method: 'POST',
      headers: {
        'X-Test-Account-Id': 'u-admin',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ codeIds: [1, 2, 3] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { code: string }
    expect(body.code).toBe(AUTH_ERROR_CODE.HIGH_RISK_FAILED)
  })

  test('adminPermissionMiddleware（RULES 驱动）：admin GET /api/admin/redemption → 200', async () => {
    const res = await app.request('/api/admin/redemption', {
      headers: { 'X-Test-Account-Id': 'u-admin' },
    })
    expect(res.status).toBe(200)
  })

  test('adminPermissionMiddleware：viewer POST /api/admin/redemption/generate → 403', async () => {
    const res = await app.request('/api/admin/redemption/generate', {
      method: 'POST',
      headers: {
        'X-Test-Account-Id': 'u-viewer',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(403)
  })

  test('DB 权限变更立即生效（下次请求读取新 permissions）', async () => {
    /** 初始 editor 不可 export */
    let res = await app.request('/codes/export', {
      method: 'POST',
      headers: { 'X-Test-Account-Id': 'u-editor' },
    })
    expect(res.status).toBe(403)

    /** 升级 editor 的 admin.codes 权限到 manage */
    const { eq } = await import('drizzle-orm')
    await db
      .update(adminAccounts)
      .set({ permissions: { ...EDITOR_PERMISSIONS, 'admin.codes': 'manage' } })
      .where(eq(adminAccounts.id, 'u-editor'))

    /** 再次请求应通过 */
    res = await app.request('/codes/export', {
      method: 'POST',
      headers: { 'X-Test-Account-Id': 'u-editor' },
    })
    expect(res.status).toBe(200)
  })
})
