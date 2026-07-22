# Hono Demo Monorepo

基于 **Bun workspaces** 的 monorepo 示例，包含应用包与共享包

## 结构

```
.
├── package.json          # 根配置，workspaces: ["packages/*"]
├── packages/
│   ├── app/              # Hono 应用
│   ├── di/               # 依赖注入 + 路由装饰器
│   └── utils/            # 共享逻辑，供 app 通过 workspace:* 引用
```

## 前置要求

- [Bun](https://bun.sh) 已安装（`curl -fsSL https://bun.sh/install | bash`）

## 安装

在仓库根目录执行：

```bash
bun install
```

会为所有 workspace 安装依赖并链接 `utils` 到 `app`

## 常用命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 在 app 中运行开发服务（需在 packages/app 下或使用 -F） |
| `bun run -F app dev` | 从根目录启动 app 开发服务 |
| `bun run -F '*' build` | 构建所有包 |
| `bun run -F '*' test` | 运行所有包的测试 |
| `bun run -F app gen:public-types` | 生成供仓库外消费的 DTO 类型 |
| `bun run -F app gen:public-types:check` | 校验上述产物是否过期（CI 用） |

进入某个包目录后可直接使用该包的脚本：

```bash
cd packages/app && bun run dev   # 启动 Hono，默认 http://localhost:3000
```

## 环境变量

应用的环境变量放在 **`packages/app/env/`** 下，按环境区分：

| 文件 | 用途 |
|------|------|
| `env/.env.development` | 开发环境（`bun run dev` 时加载） |
| `env/.env.production`  | 生产环境（部署时需自行指定加载） |

**说明**：`dev` 脚本通过 `bun --env-file=./env/.env.development run ...` 显式指定开发环境 env

`--env-file` 必须写在 `run` 之前，Bun 才会在启动前加载该文件

## 添加新包

1. 在 `packages/` 下新建目录，并添加 `package.json`.name
2. 若需依赖其他 workspace，在 dependencies 中使用 `"package-name": "workspace:*"`
3. 在根目录执行 `bun install`

## 日志系统

基于 **pino** 的结构化日志，支持终端彩色打印、文件持久化、日志轮转、路由级过滤

### 架构

```
packages/app/src/core/logger/
├── config.ts           # 配置类型与默认值
├── logger.ts           # pino 实例创建（console + file transport）
├── match.ts            # include/exclude 路由匹配
├── middleware.ts        # 请求日志中间件（替代 hono/logger）
├── validation-hook.ts   # zod-openapi 校验失败日志 + 400 响应
└── index.ts            # 统一导出 + logger 单例
```

### 配置

编辑 `packages/app/src/core/logger/config.ts`：

```ts
export const defaultLoggerConfig: LoggerConfig = {
  level: isProd() ? 'info' : 'debug',

  // 终端输出
  console: {
    enabled: true,
    colorize: !isProd(),    // 开发环境彩色，生产环境纯文本
  },

  // 文件持久化（生产环境默认开启）
  file: {
    enabled: isProd(),
    dir: LOG_DIR,           // 项目根目录 /logs
    frequency: 'daily',     // 按天轮转
    maxSize: '10m',         // 单文件超 10MB 也轮转
    extension: '.log',
  },

  // 路由过滤（支持字符串前缀 + 正则）
  request: {
    // include: ['/api'],            // 仅记录匹配的路由，为空则全部记录
    exclude: ['/health', '/favicon.ico'],  // 排除噪音路由
  },
}
```

### 过滤规则

- **include**：非空时，仅记录匹配的路由（字符串用 `startsWith`，正则用 `test`）
- **exclude**：在 include 之后应用，排除匹配的路由
- 两者都支持 `string | RegExp` 混合数组

示例：

```ts
request: {
  include: ['/api'],                    // 仅 /api 开头
  exclude: ['/api/health', /^\/api\/sse/],  // 排除 health 和 sse
}
```

### 参数校验日志

当前端传入不合法参数时（zod schema 校验失败），`defaultHook` 自动记录：

- 请求的 requestId、method、path
- 原始输入（query、params、body）
- 校验错误详情（哪个字段、期望什么、实际收到什么）

响应格式：

```json
{
  "success": false,
  "message": "参数校验失败",
  "errors": { "formErrors": [], "fieldErrors": { "name": ["..."] } },
  "data": null,
  "requestId": "xxx"
}
```

### 在代码中使用

```ts
import { logger } from '@/core/logger'

logger.info('服务启动')
logger.warn({ userId: '123' }, '用户权限不足')
logger.error({ err }, '数据库查询失败')   // pino 风格：对象在前，消息在后
```

## 前后端类型共享

两条独立通道，按消费方在不在同一个 workspace 里选：

- **workspace 内** → `hc<AppType>()`，`import type { AppType } from 'app/rpc'`，全链路推导、无需 codegen
- **仓库外** → `bun run -F app gen:public-types` 把 zod schema 派生的 DTO 打成单文件 `types/public-types.d.ts`，消费方只需装 `zod ^4`，不必引入整套 hono

产物是生成物但需提交，`gen:public-types:check` 用于在 CI 里检测它是否已过期。详见 [AGENTS.md](./AGENTS.md) 的「RPC 类型共享」一节

## 参考

- [Bun - Configuring a monorepo using workspaces](https://bun.sh/docs/guides/install/workspaces)
- [Bun - Filter (run scripts in workspaces)](https://bun.sh/docs/pm/filter)
- [pino](https://github.com/pinojs/pino) — 高性能 JSON 日志
- [pino-pretty](https://github.com/pinojs/pino-pretty) — 终端彩色格式化
- [pino-roll](https://github.com/feugy/pino-roll) — 文件日志轮转
