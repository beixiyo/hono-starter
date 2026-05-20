import type { ControllerMeta, RegisterControllersOptions, RouteRegistry } from './types'
import { getControllerMeta, getRegisteredControllers, getRoutes } from './decorators'
import { joinPath } from '../utils/path'

/**
 * 收集单个 controller 的元信息
 */
function collectControllerMeta(
  controllerClass: typeof getRegisteredControllers extends () => (infer T)[] ? T : never,
  globalPrefix: string,
): { meta: ControllerMeta, mountPath: string } | null {
  const meta = getControllerMeta(controllerClass)
  if (!meta)
    return null

  const mountPath = meta.useGlobalPrefix && globalPrefix
    ? joinPath(globalPrefix, meta.basePath)
    : meta.basePath

  return { meta, mountPath }
}

/**
 * 注册所有 controller 到路由注册器
 *
 * @param registry 路由注册器，由应用入口用框架适配器创建（如 new HonoRouteRegistry(app)）
 * @param options 可选。container 由应用入口创建（如 createContainer()），不传则每个 controller 用 new Controller() 实例化（无 DI）
 *
 * @example
 *   const registry = new HonoRouteRegistry(app)
 *   registerControllers(registry, { container, globalPrefix: '/api' })
 */
export function registerControllers(
  registry: RouteRegistry,
  options?: RegisterControllersOptions,
): void {
  const { container, globalPrefix = '' } = options ?? {}
  const controllers = getRegisteredControllers()

  for (const controllerClass of controllers) {
    const controllerMeta = collectControllerMeta(controllerClass, globalPrefix)
    if (!controllerMeta)
      continue

    const { meta, mountPath } = controllerMeta
    /** 从 ROUTES_KEY 获取路由 */
    const routes = getRoutes(controllerClass)

    if (routes.length === 0)
      continue

    /**
     * 创建 controller 实例：
     * - 有 container 时用 DI 创建（支持 @Inject 等构造函数注入）
     * - 无 container 时用 new Controller()（仅适用于无参或不需要注入的 controller）
     */
    const instance = container
      ? container.create(controllerClass as new (...args: any[]) => object)
      : new (controllerClass as new () => object)()

    /** 创建子作用域 */
    const scopeRegistry = mountPath
      ? registry.createScope(mountPath)
      : registry

    /**
     * 注册每个路由
     * 如：Get、Post、Put、Delete、Patch、Options 装饰器
     */
    for (const route of routes) {
      /**
       * 计算「不含 globalPrefix 的完整业务路径」：
       * - 无 basePath 或 basePath 为 '/'：直接使用本地 path（空或 '/' 视为根 '/')
       * - 有 basePath：
       *   - 本地 path 为空或为 '/'：表示挂在 controller 根，fullPath 等于 basePath
       *   - 否则：使用 joinPath(basePath, localPath)
       */
      const localPath = route.path ?? ''
      const hasBasePath = !!meta.basePath && meta.basePath !== '/'
      const fullPath = hasBasePath
        ? (!localPath || localPath === '/'
            ? (meta.basePath || '/')
            : joinPath(meta.basePath, localPath))
        : (localPath && localPath !== '/'
            ? localPath
            : '/')

      const routeWithFullPath = {
        ...route,
        fullPath,
      }
      const handler = (instance as any)[route.handlerName]
      if (typeof handler !== 'function') {
        throw new TypeError(
          `Controller ${controllerClass.name}: handler "${route.handlerName}" 不存在或非函数`,
        )
      }
      scopeRegistry.registerRoute(routeWithFullPath, handler.bind(instance), instance)
    }

    /** 调用 finalize 将模块挂载到主 app */
    if (scopeRegistry.finalize) {
      scopeRegistry.finalize()
    }
  }
}
