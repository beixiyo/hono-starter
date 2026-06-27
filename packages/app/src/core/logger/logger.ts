import type { LoggerConfig } from './config'
import { NodeLogger } from '@jl-org/log/node'
import { defaultLoggerConfig } from './config'

/**
 * 创建项目统一 logger（基于 @jl-org/log/node 的 NodeLogger）
 *
 * - 控制台：始终彩色输出（jl-log 内置，无需额外的美化 transport）
 * - 文件：`config.file.enabled` 时启用，经可选 peer 依赖 rotating-file-stream
 *   按时间 / 大小轮转，落盘为去除 ANSI 的 jsonl
 */
export function createLogger(config: LoggerConfig = defaultLoggerConfig): NodeLogger {
  return new NodeLogger({
    prefix: 'App',
    debug: config.level === 'debug',
    file: config.file.enabled
      ? {
          path: `${config.file.dir}/app.log`,
          interval: FREQUENCY_TO_INTERVAL[config.file.frequency ?? 'daily'],
          size: config.file.maxSize ?? '10M',
          compress: true,
        }
      : undefined,
  })
}

/** 把可读的轮转周期映射为 rotating-file-stream 的 interval 语法 */
const FREQUENCY_TO_INTERVAL: Record<'daily' | 'hourly', string> = {
  daily: '1d',
  hourly: '1h',
}
