import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../types'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { serveStatic } from 'hono/bun'
import { API_BASE_PATH } from './constants'

const rootDir = findProjectRoot(import.meta.dirname)
const publicDir = join(rootDir, 'public')

/**
 * SPA 回退：请求路径对应文件不存在时回落到 index.html，由前端路由处理
 */
function rewritePathForSpa(path: string): string {
  if (path === '/' || path === '')
    return '/index.html'

  const full = join(publicDir, path)
  try {
    if (!existsSync(full))
      return '/index.html'

    const st = statSync(full)
    if (st.isFile())
      return path

    if (st.isDirectory()) {
      return path.endsWith('/')
        ? `${path}index.html`
        : `${path}/index.html`
    }
  }
  catch {
    /** 不存在或不可读则回退 */
  }
  return '/index.html'
}

/**
 * 注册静态资源服务器（含 SPA 回退：找不到文件时返回 index.html）
 */
export function staticServer(app: OpenAPIHono<AppEnv>) {
  app.use('*', async (c, next) => {
    const path = c.req.path

    /** 所有 API_BASE_PATH 开头的请求直接放行给后面的路由 */
    if (path.startsWith(API_BASE_PATH))
      return next()

    /** 其他请求才走静态资源 + SPA 回退处理 */
    return serveStatic({
      root: publicDir,
      rewriteRequestPath: rewritePathForSpa,
    })(c, next)
  })
}

/**
 * 从当前文件所在目录向上找包含 public 的目录，作为项目根目录
 * 确保 Docker 等部署方式路径正确
 */
function findProjectRoot(startDir: string): string {
  let dir = startDir
  while (dir && dir !== '/') {
    if (existsSync(join(dir, 'public')))
      return dir
    dir = join(dir, '..')
  }
  return startDir
}
