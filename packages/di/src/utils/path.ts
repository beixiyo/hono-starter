/**
 * 通用 URL path 规范化：
 * - 去除多余空白
 * - 合并重复斜杠（/// -> /）
 * - 确保以 / 开头
 * - 默认去掉尾部斜杠（除根路径外），可通过 keepTrailingSlash 控制
 */
export function normalizeUrlPath(
  path: string,
  options?: { keepTrailingSlash?: boolean },
): string {
  const keepTrailingSlash = options?.keepTrailingSlash ?? false
  let p = path.trim()

  /** 合并重复斜杠 */
  p = p.replace(/\/+/g, '/')

  /** 确保以 / 开头 */
  if (!p.startsWith('/'))
    p = `/${p}`

  if (!keepTrailingSlash && p.length > 1 && p.endsWith('/'))
    p = p.slice(0, -1)

  return p || '/'
}

/**
 * 规范化路径：去除尾部斜杠，确保以 / 开头
 */
export function normalizePath(path: string): string {
  let normalized = path.trim()
  if (normalized.length > 1 && normalized.endsWith('/'))
    normalized = normalized.slice(0, -1)
  if (!normalized.startsWith('/'))
    normalized = '/' + normalized
  return normalized || '/'
}

/**
 * 规范化基础路径：同 normalizePath，但空字符串返回空
 */
export function normalizeBasePath(path: string): string {
  if (!path || path.trim() === '')
    return ''
  return normalizePath(path)
}

/**
 * 连接路径
 */
export function joinPath(...paths: string[]): string {
  return paths
    .map((p, i) => {
      if (i === 0)
        return normalizeBasePath(p)
      return normalizePath(p)
    })
    .filter(Boolean)
    .join('')
    || '/'
}
