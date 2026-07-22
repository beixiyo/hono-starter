# 项目规范（Agent 参考）

## 技术栈

- **运行时**: Bun
- **框架**: Hono + @hono/zod-openapi
- **DI**: 自研容器（`packages/di/src/`）
- **路由**: 基于 `@Controller` 注册，Hono adapter 挂载
- **数据库**: Drizzle ORM + PostgreSQL

## 目录约定

```
packages/
  app/src/
    modules/          # 业务模块（auth、user、file、sse、websocket、health）
      auth/
        controller.ts
        service.ts
        route.ts      # OpenAPI 路由 + 类型导出
        schema.ts     # Zod schema
        tokens.ts     # DI Symbol token
      ...
    rpc.ts            # 导出 AppType 供前端 hc<AppType>() 使用
    index.ts          # 应用启动入口
  di/src/
    di/               # DI 容器核心
    controller/       # @Controller 装饰器 + 注册器
    adapters/hono/    # Hono 路由适配器
```

---

## DI 系统

### 声明可注入类

```ts
import { Service, Repository, Injectable } from 'di/src'

// 不带 token：以类自身为 token
@Service()
export class AuthService { ... }

// 带 Symbol token（推荐，避免类耦合）
export const UserServiceToken = Symbol('UserService')

@Service(UserServiceToken)
export class UserService { ... }
```

> `@Service()` / `@Repository()` 是语义化别名，底层均为 `@Injectable()`

### 构造器注入

**方式一：`@Inject` 参数装饰器**（部分 Bun 版本有 bug，不稳定）

```ts
import { Inject } from 'di/src'
import { PgDbToken } from '@/tokens'

@Service(UserServiceToken)
export class UserService {
  constructor(@Inject(PgDbToken) private readonly db: PgDb) {}
}
```

**方式二：`@Injects` 类级装饰器**（Bun 兼容方案，推荐）

```ts
import { Injects } from 'di/src'
import { PgDbToken } from '@/tokens'

@Injects(PgDbToken)          // token 顺序与构造参数顺序一致
@Service(UserServiceToken)
export class UserService {
  constructor(private readonly db: PgDb) {}
}
```

> `@Injects` 是解决 Bun 参数装饰器 bug 的工程化方案，多依赖时按参数顺序传入 token

### 多依赖注入

```ts
@Injects(PgDbToken, CacheServiceToken)
@Service(UserServiceToken)
export class UserService {
  constructor(
    private readonly db: PgDb,
    private readonly cache: CacheService,
  ) {}
}
```

### 容器手动注册

```ts
import { createContainer } from 'di/src'

const container = createContainer()

// 注册类
container.register(UserService)
container.register(UserServiceToken, UserService)

// 注册工厂
container.register(UserServiceToken, () => new UserService())

// 注册值
container.register(UserServiceToken, { getValue: () => 42 })

// 配置对象（支持 scope）
container.register({
  token: UserServiceToken,
  useClass: UserService,
  scope: 'singleton', // 'singleton' | 'transient'，默认 singleton
})
```

---

## Controller 系统

### @Controller 装饰器

```ts
import { Controller } from 'di/src/controller'

// 带 globalPrefix（最终路径 = /api/users）
@Controller('/users')
export class UserController { ... }

// 禁用 globalPrefix（用于 /health 等）
@Controller({ basePath: '/health', useGlobalPrefix: false })
export class HealthController { ... }
```

### HTTP 方法装饰器

```ts
import { Get, Post, Put, Delete, Patch } from 'di/src/controller'

@Controller('/users')
export class UserController {
  constructor(@Inject(UserServiceToken) private readonly userService: UserService) {}

  @Get('/{id}', getUserRoute)
  async getUser(@Params('id') id: string) {
    return this.userService.getUserById(id)
  }

  @Post('/', createUserRoute)
  async createUser(@Body() body: CreateUserBody) {
    return this.userService.createUser(body)
  }
}
```

第二参数传入 `createRoute()` 返回的路由对象，DI 框架会自动提取 Zod schema 做参数校验

### 参数注入装饰器

```ts
import { Params, Query, Body, Form, Context, Next } from 'di/src/controller'

@Get('/{id}')
async handler(
  @Params('id') id: string,            // 单个路径参数
  @Query('page') page?: string,         // 单个 query 参数
  @Body() body: SomeBodyType,           // 完整 request body
  @Body('name') name: string,           // body 中的某个字段
  @Form('file') file: File,             // multipart/form-data 字段
  @Context() c: Context,               // Hono Context 原始对象
  @Next() next: () => Promise<void>,   // next 中间件
) {}
```

### 禁用响应自动包装

SSE、WebSocket 等需要直接返回 `Response` 时：

```ts
@Get('/events', sseRouteOptions, { wrapResponse: false })
async events(@Context() c: Context) {
  return streamSSE(c, async (stream) => { ... })
}
```

---

## 路由定义（OpenAPI）

每个模块在 `route.ts` 中用 `createRoute` 定义路由并导出聚合对象：

```ts
import { createRoute, z } from '@hono/zod-openapi'
import { createSuccessSchema } from '@/core'

const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['用户管理'],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: createSuccessSchema(UserSchema) } },
      description: '获取用户',
    },
  },
})

// 聚合导出，供 rpc.ts 使用
export const userApi = {
  getUser: getUserRoute,
  createUser: createUserRoute,
}
```

---

## RPC 类型共享

项目通过 Hono 的 `hc()` 实现前后端类型共享，**无需 codegen**

### 1. 后端：聚合路由，导出 AppType

`packages/app/src/rpc.ts`：

```ts
import { OpenAPIHono } from '@hono/zod-openapi'
import { authApi } from './modules/auth/route'
import { userApi } from './modules/user/route'

// 用 stub handler 构造类型用 app，不包含业务逻辑
const app = new OpenAPIHono()
  .openapi(userApi.getUser, () => ({} as any))
  .openapi(userApi.createUser, () => ({} as any))
  .openapi(authApi.login, () => ({} as any))

export type AppType = typeof app
```

> 新增模块时，必须在此文件添加对应 `.openapi()` 调用，否则前端无类型

### 2. 前端：使用 hc<AppType>() 调用

```ts
import type { AppType } from 'app/rpc'
import { hc } from 'hono/client'

const client = hc<AppType>('http://localhost:3005/api', {
  fetch: async (input, init) => {
    const headers = new Headers(init?.headers ?? {})
    headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers })
  },
})

// 全类型推导
const res = await client.auth.jwt.login.$post({
  json: { email: 'admin@example.com', password: 'password' },
})
const data = await res.json()
// data: { success: true, data: { token: string, refreshToken: string, ... } }

// 路径参数
const userRes = await client.users[':id'].$get({ param: { id: 'user_123' } })
```

路径转换规则：`/users/{id}` → `client.users[':id'].$get()`

### 3. 仓库外消费方：分发 DTO 类型

`hc<AppType>()` 依赖 `"app": "workspace:*"`，只对**同一 workspace 内**的前端有效。独立仓库（不同 git 仓、不同包管理器）解析不到 `app` 这个包，此时走第二条通道：把 zod schema 派生的 DTO 打成单文件 `.d.ts`，消费方只需装 `zod`

| | `./rpc`（`build:rpc`） | `./public-types`（`gen:public-types`） |
|---|---|---|
| 内容 | Hono `AppType`，含路由与请求/响应签名 | 纯 DTO 形状 |
| 用法 | `hc<AppType>()` 全链路推导 | `import type { User } from '<产物路径>'` |
| 消费方依赖 | `hono` + `zod` | 仅 `zod ^4` |
| 适用 | workspace 内 | **仓库外** |

```bash
bun run -F app gen:public-types                      # 生成到 packages/app/types/（本地产物，已 gitignore）
bun run -F app gen:public-types -- --out <绝对路径>    # 直接写进消费方仓库（实际用法）
bun run -F app gen:public-types:check -- --out <同上>  # 校验消费方那份是否过期
```

也可用环境变量 `APP_PUBLIC_TYPES_OUT` 固化消费方路径，省得每次传 `--out`

新模块要对外暴露类型时，照抄 `src/modules/user/public-types.ts`：

```ts
export type { User } from './schema'
```

然后在 `src/public-types.ts` 补一行 re-export（与 `rpc.ts` 要手工补 `.openapi()` 的约定一致）

**⚠️ 硬约束**：公共类型入口只能导出 zod schema 的 `z.infer` 派生形状，**不能引用 hono 自有类型**（`RouteConfig` / `OpenAPIHono` / `createRoute` 返回类型等）。否则产物会发射成合并 import，改写不到，生成脚本直接失败：

```
[gen-public-types] 产物仍引用 @hono，消费方仅装 zod 将无法编译：
  3: import { RouteConfig, z } from '@hono/zod-openapi';
```

这是**响亮失败**而非静默产坏产物，失败时目标文件零污染

另外两点：产物只有**形状**，运行时规则不保留（`z.string().min(3)` 只剩 `z.ZodString`）；消费方必须装 **zod v4**（产物用到 `z.core.$strip`）

> **产物归属**：`packages/app/types/` 已被 gitignore，本仓库里那份只是本地构建产物。真正被提交、被 review、被 tsc 检查的那份在**消费方仓库**里（由 `--out` 写进去）。
>
> 因此漂移检测应当带 `--out` 指向消费方那份。不带 `--out` 时它比对的是**本地上次生成的**那份（schema 改了没重跑同样会失败），但该文件不进 git，新 clone 上直接报「产物不存在」—— 挂进 CI 没有意义。
>
> schema 改了不重新生成，消费方类型会静默过期。本仓库**没有 CI**，请自行把 `gen:public-types:check -- --out <消费方路径>` 挂进流水线或 pre-push，否则这道保护等于不存在

---

## 模块自动加载

开发时 Bun 动态扫描 `modules/` 下所有 `.ts` 文件（排除 `index.ts`、`.test.ts`、`.d.ts`）并 `import`，装饰器副作用注册到全局 pending 列表

生产时由 `modules/auto-import.ts` 静态导入（需执行 `bun run build:modules` 或对应脚本生成）

**新增模块时**，在 `auto-import.ts` 手动补充 import，或重新运行生成脚本

---

## 应用启动流程

```
loadModules()              ← 扫描/import 模块，触发装饰器副作用
  ↓
createContainer()          ← 创建 DI 容器
  ↓
applyToContainer()         ← 将全局 pending 注入到容器
  ↓
createApp(container)       ← 创建 OpenAPIHono 实例
  ↓
registerControllers()      ← 实例化 @Controller 类，挂载路由
  ↓
runPgMigrations()          ← 数据库迁移
```

---

## 日志

统一使用 `src/utils` 的 logger（`@/utils`）：

```ts
import { logger } from '@/utils'

logger.info('信息')
logger.error('错误', err)
```

基于 `@jl-org/log/node` 的 `NodeLogger`，前缀为 `App`。项目内**禁止**另建日志实例

---

## 其他约定

- **环境变量与类型**：`src/types/env.ts`、`packages/utils`
- **错误处理与 OpenAPI**：`src/core`
- **响应格式**：统一经 `wrapResponseFn` 包装，返回 `{ success, message, data, requestId }`
- **测试**：Bun 内置测试，文件命名 `*.test.ts`，可用 `startApp({ load: false })` 注入 mock
- **⚠️ jsonb 列必须用 `src/db/columns.ts` 的 `jsonb`，禁止从 `drizzle-orm/pg-core` 引入 jsonb**：drizzle 内置 `jsonb` 与 `bun-sql` 驱动会各序列化一次，把对象/数组存成字符串标量（`jsonb_typeof = 'string'`），令 `@>`、`->`、`-` 等操作符**静默失效**（读取因兜底 `JSON.parse` 暂时正常而极隐蔽）。这是 drizzle-orm 上游 bug（drizzle-team/drizzle-orm#4942、#5139）。`src/db/columns.ts` 的自定义 `jsonb`（写入不 stringify、读取兜底 parse）已规避——新增 jsonb 列直接 `import { jsonb } from '../columns'` 即可，调用方式不变
