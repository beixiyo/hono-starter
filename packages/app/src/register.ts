import type { PgDb } from './db/client'
import { applyToContainer, Container } from 'di'
import { createPgDb, PgDbToken } from './db/client'

/** 创建并配置 DI 容器 */
export function createContainer(overrides?: CreateContainerOverrides): Container {
  const container = new Container()

  const db = overrides?.skipDb
    ? {}
    : overrides?.pgDb ?? createPgDb()
  container.register({ token: PgDbToken, useValue: db })

  applyToContainer(container)
  return container
}

export interface CreateContainerOverrides {
  /** 覆盖 PgDb，用于测试时注入事务内 Db 实现回滚 */
  pgDb?: PgDb
  /** 是否跳过数据库连接创建 */
  skipDb?: boolean
}
