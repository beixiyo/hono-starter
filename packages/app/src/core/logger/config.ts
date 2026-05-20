import { join } from 'node:path'
import { isProd } from 'utils'

const LOG_DIR = join(import.meta.dir, '../../../../logs')

export interface LogRouteFilter {
  /** 仅记录匹配的路由，为空则记录全部 */
  include?: (string | RegExp)[]
  /** 排除匹配的路由（在 include 之后应用） */
  exclude?: (string | RegExp)[]
}

export interface LoggerConfig {
  level: string

  console: {
    enabled: boolean
    colorize: boolean
  }

  file: {
    enabled: boolean
    dir: string
    /** @default 'daily' */
    frequency?: 'daily' | 'hourly' | number
    /** @default '10m' */
    maxSize?: string
    /** @default '.log' */
    extension?: string
  }

  request: LogRouteFilter
}

export const defaultLoggerConfig: LoggerConfig = {
  level: isProd()
    ? 'info'
    : 'debug',

  console: {
    enabled: true,
    colorize: !isProd(),
  },

  file: {
    enabled: isProd(),
    dir: LOG_DIR,
    frequency: 'daily',
    maxSize: '10m',
    extension: '.log',
  },

  request: {
    exclude: ['/health', '/favicon.ico'],
  },
}
