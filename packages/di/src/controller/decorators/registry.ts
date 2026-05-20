import type { ControllerClass } from '../types'

/** 已注册的 controller 类集合 */
const registeredControllers = new Set<ControllerClass>()

/** 注册一个 controller 类（供 @Controller 装饰器内部使用） */
export function addRegisteredController(controller: ControllerClass): void {
  registeredControllers.add(controller)
}

/**
 * 获取所有已注册的 controller 类
 */
export function getRegisteredControllers(): ControllerClass[] {
  return [...registeredControllers]
}

/**
 * 清空已注册的 controller（用于测试）
 */
export function clearRegisteredControllers(): void {
  registeredControllers.clear()
}
