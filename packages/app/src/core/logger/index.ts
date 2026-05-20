import { createLogger } from './logger'

export { defaultLoggerConfig } from './config'
export type { LoggerConfig, LogRouteFilter } from './config'
export { createLogger } from './logger'
export { shouldLogRoute } from './match'
export { requestLogger } from './middleware'

export type { RequestLoggerOptions } from './middleware'
export { createValidationHook } from './validation-hook'
export type { ValidationHookOptions } from './validation-hook'

export const logger = createLogger()
