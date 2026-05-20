import type { TransportTargetOptions } from 'pino'
import type { LoggerConfig } from './config'
import pino from 'pino'
import { defaultLoggerConfig } from './config'

export function createLogger(config: LoggerConfig = defaultLoggerConfig) {
  const targets: TransportTargetOptions[] = []

  if (config.console.enabled) {
    targets.push({
      target: 'pino-pretty',
      level: config.level,
      options: {
        colorize: config.console.colorize,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    })
  }

  if (config.file.enabled) {
    targets.push({
      target: 'pino-roll',
      level: config.level,
      options: {
        file: `${config.file.dir}/app`,
        frequency: config.file.frequency ?? 'daily',
        size: config.file.maxSize ?? '10m',
        mkdir: true,
        extension: config.file.extension ?? '.log',
      },
    })
  }

  if (targets.length === 0) {
    return pino({ level: 'silent' })
  }

  return pino({
    level: config.level,
    transport: { targets },
  })
}
