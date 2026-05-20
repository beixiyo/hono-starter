import type { LogRouteFilter } from './config'

function matchPattern(path: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp)
    return pattern.test(path)
  return path.startsWith(pattern)
}

export function shouldLogRoute(path: string, filter: LogRouteFilter): boolean {
  const { include, exclude } = filter

  if (include?.length) {
    if (!include.some(p => matchPattern(path, p)))
      return false
  }

  if (exclude?.length) {
    if (exclude.some(p => matchPattern(path, p)))
      return false
  }

  return true
}
