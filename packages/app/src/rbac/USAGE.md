# RBAC 模块：修改指南与接入说明

> v2 设计：**账号级动态权限**。每个账号独立持有一份 `AccountPermissions` 映射（资源 → 级别），存储在 SQLite 的 `admin_accounts.permissions` 字段。运营可在后台直接改权限，无需重新部署

## 一、功能说明

| 能力                             | 说明                                                    |
|----------------------------------|---------------------------------------------------------|
| 账号 × 资源 × 操作鉴权           | 账号独立权限映射 + 操作级别比较                         |
| 身份解析（JWT → AdminIdentity）  | `identityMiddleware`（不再携带 role）                   |
| 权限加载（DB → ctx）             | `createPermissionsMiddleware(db)`，每请求从 DB 读权限   |
| 全局路由权限守卫                 | `adminPermissionMiddleware` + `route-permissions.ts`    |
| 按路由权限守卫                   | `requirePermission({ resource, action })`               |
| 高危动作静态守卫                 | `requireHighRiskGuard` = `requiredPermission` + `confirmWord`；**不校验密码** |
| 高危动作密码校验                 | **Controller 层显式调用**，见下方「四」                 |
| 权限快照接口                     | `buildPermissionSnapshot`，供前端控制导航/按钮          |
| 错误码与类型                     | `AUTH_ERROR_CODE`、`AuthResult` 等                      |
| 预设权限模板                     | `SEED_PERMISSION_TEMPLATES`：`full` / `operations` / `editor` / `readonly` |

中间件链（鉴权路径）：

```ts
app.use('/api/*', jwtMiddleware)                     // 仅需鉴权路径
app.use('/api/*', identityMiddleware)                // JWT payload → c.get('identity')
app.use('/api/*', createPermissionsMiddleware(db))   // DB → c.get('accountPermissions')
app.use('/api/*', adminPermissionMiddleware)         // 按 RULES 做 resource+action 校验
```

**新增接口只需在 `route-permissions.ts` 的 `RULES` 里补一条映射**即可

---

## 二、常见修改要做哪些事

### 1. 新增一个 Admin/Analyse 接口（最常见）

**只改一处**：`route-permissions.ts`，在 `RULES` 中新增一条

```ts
const RULES: RoutePermissionRule[] = [
  // ... 现有规则
  { method: 'get',  pathPrefix: '/api/admin/feedback',        resource: 'admin.feedback', action: 'read'  },
  { method: 'post', pathPrefix: '/api/admin/feedback/reply',  resource: 'admin.feedback', action: 'write' },
]
```

未在 `RULES` 中登记的路由会被放行（兼容未迁移路由），**建议所有需鉴权接口都显式登记**

---

### 2. 新增一个资源（新页面/新模块）

**只改 1 个文件**：`types.ts` — 在 `ResourceId` 中增加新 ID

```ts
export type ResourceId
  = | 'analyse.dashboard'
    | 'admin.users'
  // ...
    | 'admin.accounts'
    | 'admin.xxx' // 新增
```

然后在 `route-permissions.ts` 的 `RULES` 中补充该资源的接口。DB 中给账号分配新资源权限即可（无需重新部署）

> 旧版还需改 `PERMISSION_MATRIX`；v2 不再存在静态矩阵

---

### 3. 调整某账号对某资源的权限级别

**改 DB**，不再改代码：

```ts
await db
  .update(adminAccounts)
  .set({ permissions: { ...old, 'admin.audit': 'view' } })
  .where(eq(adminAccounts.id, accountId))
```

可选值：`none` | `view` | `edit` | `manage`。下次请求立即生效（中间件每请求读 DB）

---

### 4. 新增高危动作（如新的「作废/解绑」类接口）

需改 **3 个文件**，并在业务层做密码校验与审计

**① types.ts** — 增加动作 ID（格式 `resource:action_name`）：

```ts
export type HighRiskActionId
  = | 'admin.users:cancel_subscription'
    | 'admin.users:unbind_device'
  // ...
    | 'admin.users:reset_quota' // 新增
```

**② constants.ts** — 在 `HIGH_RISK_POLICIES` 中增加一条：

```ts
'admin.users:reset_quota': {
  requiredPermission: { resource: 'admin.users', level: 'manage' },
  requirePassword:    true,    // 仅作为元数据标注；中间件不读取，由 controller 强制
  confirmWord:        'RESET', // 固定确认词；动态则填 true；不需要则 false
  description:        '重置用户配额',
},
```

**③ route-permissions.ts + Handler**
该接口在 `RULES` 中 `action: 'high_risk'`。handler 前串联 `requireHighRiskGuard('admin.users:reset_quota')` 做静态规则守卫（权限级别 + 确认词格式），**密码校验由 handler 内部调用 `AdminAccountService.verifyPasswordById` 完成**。请求体**平铺**：业务字段 + `confirmWord?`（仅当策略要求时）+ `password`（业务字段，与 RBAC 无关）。具体模式见「四」。

---

### 5. 新增操作级别（极少见）

若需新的操作级别（如 `administer`）：

**① types.ts** — `ActionLevel` 增加：

```ts
export type ActionLevel = 'read' | 'write' | 'export' | 'high_risk' | 'account_admin' | 'administer'
```

**② constants.ts** — `ACTION_REQUIRED_LEVEL` 增加对应最低页面权限：

```ts
export const ACTION_REQUIRED_LEVEL = {
  read:          'view',
  write:         'edit',
  export:        'manage',
  high_risk:     'manage',
  account_admin: 'manage',
  administer:    'manage', // 新增
}
```

**③ route-permissions.ts** — 需要该级别的路由在 `RULES` 中使用 `action: 'administer'`

---

## 三、如何接入 RBAC 模块

### 1. 类型

确保 Hono `AppEnv.Variables` 含有：

```ts
// types/env.ts
export type AppEnv = {
  Variables: {
    requestId:          string
    jwtPayload:         { sub: string, exp: number, email?: string, status?: 'active' | 'disabled' }
    identity:           AdminIdentity         | undefined
    accountPermissions: AccountPermissions    | undefined
    parsedBody:         Record<string, unknown> | undefined
  }
}
```

### 2. 挂载顺序

```ts
import { createSqliteDb } from '@/db/client'
import {
  adminPermissionMiddleware,
  createPermissionsMiddleware,
  identityMiddleware,
} from '@/rbac'

const db = createSqliteDb()

app.use('/api/admin/*', jwt({ secret: JWT_SECRET }))
app.use('/api/admin/*', identityMiddleware)
app.use('/api/admin/*', createPermissionsMiddleware(db))
app.use('/api/admin/*', adminPermissionMiddleware) // 或按路由用 requirePermission
```

### 3. 二选一

- **全局方式**：只挂 `adminPermissionMiddleware`，鉴权由 `route-permissions.ts` 的 `RULES` 驱动
- **按路由方式**：不挂 `adminPermissionMiddleware`，在每条路由上声明权限：

```ts
import { requireHighRiskGuard, requirePermission } from '@/rbac'

app.get(
  '/api/admin/users',
  requirePermission({ resource: 'admin.users', action: 'read' }),
  listUsersHandler,
)

app.post(
  '/api/admin/users/:id/cancel',
  requirePermission({ resource: 'admin.users', action: 'high_risk' }),
  requireHighRiskGuard('admin.users:cancel_subscription'),
  handler,
)
```

### 4. 权限快照

```ts
app.get('/api/admin/me/permissions', async (c) => {
  const identity    = c.get('identity')!
  const permissions = c.get('accountPermissions')!
  return c.json(buildPermissionSnapshot(identity, permissions))
})
```

### 5. 导入

```ts
import {
  adminPermissionMiddleware,
  buildPermissionSnapshot,
  checkHighRiskAction,
  checkPermission,
  createPermissionsMiddleware,
  getPermissionLevel,
  hasActionPermission,
  identityMiddleware,
  requireHighRiskGuard,
  requirePermission,
  SEED_PERMISSION_TEMPLATES,
} from '@/rbac'
```

---

## 四、高危动作密码校验的实际做法（重要）

**中间件不做密码校验**。`requireHighRiskGuard` 只做两件事：
1. `requiredPermission`：校验账号对策略资源的权限级别
2. `confirmWord`：校验请求体里的确认词格式（固定比对 / 动态仅检查非空）

**密码正确性 + 审计日志**属于业务层职责，放在 controller 里显式编排。原因：

- `Bun.password.verify` 比较慢（100~300ms），放中间件会把所有高危路由的 p99 拉高
- 审计日志需要 `targetType` / `targetId` / `newValue` 等业务字段，中间件拿不到
- 失败后策略（返回码、锁账号、限流）因动作而异，controller 按需编排更灵活

### Schema — body 平铺，`password` 与业务字段同级

```ts
// modules/admin/schema.ts
export const AdminRevokeCodesSchema = z.object({
  codeIds: z.array(z.string()).min(1).max(50),
  password: z.string().openapi({ description: '当前操作者密码（SHA-256 hex）' }),
  // 如策略要求动态确认词：
  confirmWord: z.string().optional(),
})
```

> 前端发送 `SHA-256(plainPassword).hex`，**永不发明文**。DB 存储 `Bun.password.hash(clientHash)`。

### Service — 提供按 ID 验密码的方法

```ts
// modules/admin/services/admin-account.service.ts
async verifyPasswordById(id: string, clientHash: string): Promise<boolean> {
  const [account] = await this.db
    .select({ passwordHash: adminAccounts.passwordHash })
    .from(adminAccounts)
    .where(eq(adminAccounts.id, id))
    .limit(1)
  if (!account) return false
  return Bun.password.verify(clientHash, account.passwordHash)
}
```

### Controller — 显式调用 + 审计 try/catch

```ts
@Post('/redemption/revoke', revokeCodesRoute)
async revokeCodes(
  @Body() body: z.infer<typeof AdminRevokeCodesSchema>,
  @Ctx() c: Context<AppEnv>,
) {
  const identity = c.get('identity')!

  // ⭐ 密码校验（业务层，不走 RBAC 中间件）
  if (!body.password) throw new HTTPException(400, { message: '需要密码' })
  const ok = await this.accounts.verifyPasswordById(identity.id, body.password)
  if (!ok) throw new HTTPException(403, { message: '密码错误' })

  const auditBase = { adminId: identity.id, action: 'codes.revoke', targetId: body.codeIds.join(',') }
  try {
    const res = await this.service.revoke(body.codeIds)
    this.audit.log({ ...auditBase, result: 'Success', newValue: { count: body.codeIds.length } })
    return res
  }
  catch (error) {
    this.audit.log({ ...auditBase, result: 'Fail', failReason: String(error) })
    throw error
  }
}
```

### RBAC 模块边界

| 层 | 职责 |
|---|------|
| `requirePermission` 中间件 | 权限级别 |
| `requireHighRiskGuard` 中间件 | `requiredPermission` + `confirmWord` 格式 |
| `RiskGuardPayload` 类型 | **只含 `confirmWord?`**，不含 `password` / `reason` |
| Controller handler | 密码校验、审计日志、锁账号等所有"带业务上下文"的逻辑 |

> 如何避免 handler 漏写密码校验？推荐用装饰器（如 `@HighRisk(actionId)`）封装 `verifyPassword + audit try/catch` 一条龙；或 ESLint 规则扫描 `action: 'high_risk'` 路由必须调用 `verifyPasswordById`。

---

## 五、数据模型

**表**：`admin_accounts`（SQLite，见 `src/db/schema/admin-accounts.ts`）

| 列             | 类型                  | 说明                                     |
|----------------|-----------------------|------------------------------------------|
| `id`           | text PK               | 账号 ID（UUID 或任意唯一字符串）         |
| `email`        | text UNIQUE           | 登录邮箱                                 |
| `passwordHash` | text                  | 密码哈希（bcrypt/argon2），外部校验       |
| `status`       | `'active'\|'disabled'`| 禁用时所有鉴权接口返回 401               |
| `permissions`  | text (JSON)           | `AccountPermissions` 映射（资源→级别）   |
| `createdAt`    | integer (ms)          | 创建时间                                 |
| `updatedAt`    | integer (ms)          | 更新时间                                 |

> Refresh Token 仍走 Postgres（`admin_refresh_tokens`），两套存储并存，不强耦合

---

## 六、本地测试（内存 SQLite）

```ts
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { adminAccounts } from '@/db/schema'

const sqlite = new Database(':memory:')
sqlite.run(`CREATE TABLE admin_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  permissions TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
)`)
const db = drizzle(sqlite)

await db.insert(adminAccounts).values({
  id: 'u-admin',
  email: 'admin@test.com',
  passwordHash: 'fake',
  status: 'active',
  permissions: SEED_PERMISSION_TEMPLATES[0].permissions, // full（全权限）
})
```

参考 `rbac.test.ts` 的「中间件集成测试」一节可直接复用

---

## 七、文件职责速查

| 文件                    | 职责                                                             |
|-------------------------|------------------------------------------------------------------|
| `types.ts`              | 权限级别、资源 ID、`AccountPermissions`、高危动作 ID、身份/结果类型 |
| `constants.ts`          | 错误码、级别序列、操作要求、高危策略、预设模板                    |
| `guard.ts`              | 鉴权与快照计算（无 Hono 依赖）                                    |
| `middleware.ts`         | 身份解析、权限加载、全局/按路由权限守卫、高危守卫                 |
| `route-permissions.ts`  | 请求 method+path → resource+action 映射，驱动全局守卫             |
| `index.ts`              | 统一导出                                                         |
| `USAGE.md`              | 本文档                                                           |

---

## 八、与旧版的区别

| 维度            | v1（静态矩阵）                   | v2（动态 DB）                         |
|-----------------|---------------------------------|---------------------------------------|
| 权限存储        | 代码矩阵 `PERMISSION_MATRIX`     | `admin_accounts.permissions` (JSON)   |
| 权限粒度        | 角色级（4 角色统一）              | 账号级（每账号独立）                   |
| 高危鉴权        | `allowRoles` 白名单              | `requiredPermission` 权限级别比较      |
| 高危请求体      | 嵌套 `{ _risk: { password, ... } }` | 平铺；`confirmWord` 归 RBAC，`password` 归业务 schema |
| 密码校验位置    | 中间件声称做，实则留 TODO         | **明确放在 Controller**，由 `AdminAccountService.verifyPasswordById` 执行 |
| 调整权限        | 改代码 + 部署                    | 改 DB（后台直接生效）                  |
| `AdminIdentity` | 含 `role`                        | 不含 `role`                            |
| JWT payload     | 含 `role`                        | 不含 `role`（仅 `sub/email/status`）   |
| 依赖            | 纯内存                           | 每请求一次 DB 查询                     |
