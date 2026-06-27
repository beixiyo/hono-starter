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
  /** 日志级别，`'debug'` 时输出 debug 日志，其余级别仅过滤 debug（jl-log 无层级阈值） */
  level: 'debug' | 'info'

  file: {
    enabled: boolean
    dir: string
    /** 轮转周期 @default 'daily' */
    frequency?: 'daily' | 'hourly'
    /** 单文件大小上限，rotating-file-stream 语法（B/K/M/G）@default '10M' */
    maxSize?: string
  }

  request: LogRouteFilter
}

export const defaultLoggerConfig: LoggerConfig = {
  level: isProd()
    ? 'info'
    : 'debug',

  file: {
    /** 生产默认落盘；开发可临时 `LOG_FILE=true` 开启文件日志做验证，无需改代码 */
    enabled: isProd() || process.env.LOG_FILE === 'true',
    dir: LOG_DIR,
    frequency: 'daily',
    maxSize: '10M',
  },

  request: {
    exclude: ['/health', '/favicon.ico'],
  },
}
