import type { Container } from 'di'
import type { AppEnv } from './types'
import { OpenAPIHono } from '@hono/zod-openapi'
import { registerControllers } from 'di'
import { HonoRouteRegistry } from 'di/hono'
import { websocket } from 'hono/bun'
import { isProd } from 'utils'
import { API_BASE_PATH, OPENAPI_CONFIG } from './core/constants'
import { errorHandler, notFoundHandler } from './core/error-handler'
import { createValidationHook, logger } from './core/logger'
import { registerMiddleware } from './core/middleware'
import { registerOpenAPI } from './core/openapi'
import { jsonOk } from './core/response'
import { staticServer } from './core/static-server'
import { runPgMigrations } from './db/migrate'
import { loadModules } from './modules'
import { createContainer } from './register'

const validationHook = createValidationHook({ logger })

/**
 * 创建应用实例：中间件、静态资源、路由、OpenAPI、错误处理
 */
function createApp(container: Container) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook: validationHook })

  registerMiddleware(app)
  staticServer(app)

  const registry = new HonoRouteRegistry<AppEnv>(app, '', null, {
    wrapResponseFn: (c, data) => jsonOk(c, data),
    defaultHook: validationHook,
  })
  registerControllers(registry, { container, globalPrefix: API_BASE_PATH })

  if (!isProd())
    registerOpenAPI(app)

  app.onError(errorHandler)
  app.notFound(notFoundHandler)

  return app
}

/** 构建 Bun.serve 的配置 */
function createServeOptions(app: OpenAPIHono<AppEnv>): ServeOptions {
  return {
    fetch: app.fetch,
    port: Number.parseInt(process.env.PORT || '3009'),
    websocket: websocket as any,
  }
}

/**
 * 主流程：加载模块 → 容器收集模块 → 应用 → 服务配置
 */
export async function startApp(options: StartAppOptions = {}) {
  const { container: injectedContainer, beforeCreateApp, load = true } = options

  if (load)
    await loadModules()

  const skipDb = !(process.env.DATABASE_URL || process.env.POSTGRES_HOST)
  if (skipDb)
    logger.warn('DATABASE_URL 未配置，跳过 SQL 连接创建')

  const container = injectedContainer ?? createContainer({ skipDb })
  await beforeCreateApp?.(container)
  const app = createApp(container)

  if (!skipDb) {
    try {
      await runPgMigrations()
    }
    catch (error) {
      logger.error({ err: error }, 'PostgreSQL 迁移失败')
      throw error
    }
  }

  return {
    app,
    container,
  }
}

// eslint-disable-next-line import/no-mutable-exports
let endpoint: ServeOptions | undefined
if (import.meta.main) {
  const { app } = await startApp()
  endpoint = createServeOptions(app)
  logger.info(`Docs is running at http://localhost:${endpoint.port}${OPENAPI_CONFIG.uiPath}`)
}

export default endpoint

/**
 * Bun 默认导出支持的配置类型（即 Bun.serve 的选项）
 * 包含 port、hostname、fetch、websocket、maxRequestBodySize、development 等
 * 使用：import type { ServeOptions } from 'app'
 */
export type ServeOptions = Parameters<typeof Bun.serve>[0]

export type StartAppOptions = {
  /**
   * 允许测试/脚本传入自定义容器（不传则使用默认 createContainer）
   */
  container?: Container
  /**
   * 在 createApp 之前对容器做注入/覆写（如 mock service）
   *
   * 注意：controller 会在 createApp 时被实例化，因此覆写必须在此阶段完成。
   */
  beforeCreateApp?: (container: Container) => void | Promise<void>
  /**
   * 是否加载模块（默认 true）。仅在非常确定无需动态收集模块时才关闭。
   */
  load?: boolean
}
