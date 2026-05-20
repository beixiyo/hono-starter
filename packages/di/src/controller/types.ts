import type { Container } from '../di'

/** HTTP 方法 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options'

/**
 * OpenAPI 请求体定义
 * 不同框架有不同的 schema 类型，这里用 unknown
 */
export interface OpenApiRequest {
  params?: unknown
  query?: unknown
  body?: unknown
  headers?: unknown
  cookies?: unknown
}

/**
 * OpenAPI 响应定义
 */
export interface OpenApiResponse {
  description: string
  content?: Record<string, { schema: unknown }>
  headers?: Record<string, unknown>
}

/**
 * OpenAPI 元信息（框架无关的通用部分）
 */
export interface OpenApiMeta {
  tags?: string[]
  summary?: string
  description?: string
  request?: OpenApiRequest
  responses?: Record<number, OpenApiResponse>
  security?: Array<Record<string, string[]>>
  deprecated?: boolean
}

/**
 * 路由配置（框架无关）
 */
export interface RouteConfig extends OpenApiMeta {
  method: HttpMethod
  path: string
}

/**
 * 参数来源（与框架无关的语义）
 */
export type ParamSource = 'body' | 'form' | 'params' | 'query' | 'context' | 'next'

/**
 * 单个参数的注入元数据（@Body / @Form / @Params / @Query 等写入）
 */
export interface ParamMeta {
  source: ParamSource
  /** 可选 key，如 @Params('id')、@Query('page') */
  key?: string
}

/**
 * 某 handler 的参数元数据，按参数下标排列；无装饰器的位置为 undefined
 */
export type HandlerParamMeta = (ParamMeta | undefined)[]

/**
 * 路由元信息（装饰器收集）
 */
export interface RouteMeta extends Partial<RouteConfig> {
  /** 处理函数名称 */
  handlerName: string
  /**
   * 由 registry 在注册阶段补全的「完整路径」
   * 通常为 controller.basePath 与装饰器本地 path 通过 joinPath 计算出的结果，
   * 不包含 globalPrefix（globalPrefix 通常由具体框架在挂载时处理，如 app.route('/api', module)）。
   *
   * 注意：在支持“模块/子路由挂载”的框架（例如 Hono 的 app.route(basePath, module)）中，
   * 运行时注册到 module 内的路径一般仍使用装饰器的本地 path；fullPath 更偏向于描述/校验用途，
   * 不应被适配器用作“再次拼接 basePath”的依据。
   */
  fullPath?: string
  /**
   * 适配器自定义的元信息
   * 由具体框架适配器解释其结构（如 OpenAPI 配置、框架特定选项等）
   */
  adapterMeta?: unknown
  /** HTTP 方法 */
  method?: HttpMethod
  /** 路径 */
  path?: string
}

/**
 * Controller 类构造函数类型
 */
export type ControllerClass = new (...args: any[]) => object

/**
 * Controller 选项（@Controller 装饰器入参）
 */
export interface ControllerOptions {
  basePath: string
  /**
   * 优先级高于全局的 globalPrefix，用于控制是否使用全局前缀
   * @default true
   */
  useGlobalPrefix?: boolean
}

/**
 * Controller 元信息（由装饰器写入，供 registerControllers 使用）
 */
export interface ControllerMeta {
  basePath: string
  controllerClass: ControllerClass
  /**
   * 优先级高于全局的 globalPrefix，用于控制是否使用全局前缀
   * @default true
   */
  useGlobalPrefix: boolean
}

/**
 * 路由注册器接口 - 框架适配器需实现此接口
 */
export interface RouteRegistry {
  /**
   * 注册单个路由，如 Get、Post、Put、Delete、Patch、Options 装饰器
   * @param meta 路由元信息
   * @param handler 处理函数（已绑定到 controller 实例）
   * @param instance controller 实例
   */
  registerRoute: (meta: RouteMeta, handler: Function, instance: object) => void

  /**
   * 创建子作用域 Module（用于 basePath）
   * @param basePath 基础路径
   * @returns 新的 RouteRegistry
   */
  createScope: (basePath: string) => RouteRegistry

  /**
   * 完成注册（可选，用于后处理）
   */
  finalize?: () => void
}

/**
 * 注册 Controller 的选项（由应用入口传入 registerControllers）
 */
export interface RegisterControllersOptions {
  /** DI 容器，由应用 createContainer() 等创建。不传时 controller 用 new Controller() 实例化，无法做构造函数注入 */
  container?: Container
  /**
   * 全局路由前缀，如 '/api'。
   * 仅对 useGlobalPrefix 为 true 的 controller 生效；单个 controller 可通过 @Controller 的
   * useGlobalPrefix: false 单独覆盖，不使用此前缀。未传或为空时，所有 controller 都只使用各自的 basePath。
   */
  globalPrefix?: string
}
