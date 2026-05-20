import type { ControllerClass, ControllerMeta, RouteMeta } from '../types'
import { CONTROLLER_KEY, ROUTES_KEY } from '../constants'

/**
 * 获取 controller 的路由元信息
 */
export function getRoutes(target: ControllerClass): RouteMeta[] {
  return (target as any)[ROUTES_KEY] ?? []
}

/**
 * 获取 controller 元信息
 */
export function getControllerMeta(target: ControllerClass): ControllerMeta | undefined {
  return (target as any)[CONTROLLER_KEY]
}

/**
 * 添加路由元信息到 controller，如 Get、Post、Put、Delete、Patch、Options 装饰器
 */
export function addRoute(target: object, meta: RouteMeta): void {
  const constructor = (target as any).constructor
  const routes: RouteMeta[] = (constructor as any)[ROUTES_KEY] ?? []
  routes.push(meta)
  ;(constructor as any)[ROUTES_KEY] = routes
}
