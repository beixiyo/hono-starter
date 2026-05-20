import type { ControllerClass, ControllerMeta } from '../types'
import { CONTROLLER_KEY } from '../constants'
import { normalizeBasePath } from '../../utils/path'
import { addRegisteredController } from './registry'

/**
 * @Controller 装饰器，声明路径控制器
 * @example
 *   @Controller('/users')
 *   class UserController {}
 *
 *   @Controller({ basePath: '/health', useGlobalPrefix: false })
 *   class HealthController {}
 */
export function Controller(basePath: string): ClassDecorator
export function Controller(options: { basePath: string, useGlobalPrefix?: boolean }): ClassDecorator
export function Controller(param: string | { basePath: string, useGlobalPrefix?: boolean }): ClassDecorator {
  const options = typeof param === 'string'
    ? { basePath: normalizeBasePath(param), useGlobalPrefix: true }
    : { useGlobalPrefix: true, ...param, basePath: normalizeBasePath(param.basePath) }

  return (target) => {
    const controller = target as unknown as ControllerClass

    const meta: ControllerMeta = {
      basePath: options.basePath,
      controllerClass: controller,
      useGlobalPrefix: options.useGlobalPrefix ?? true,
    }

    ;(target as any)[CONTROLLER_KEY] = meta
    addRegisteredController(controller)
  }
}
