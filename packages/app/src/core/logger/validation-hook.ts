/**
 * zod-openapi 全局校验失败钩子
 *
 * 职责：
 * - 把 ZodError 展开成带**完整字段路径**的 issue 列表（`flattenError` 只展开一层，
 *   对「数组 / 嵌套对象」的请求体会把 `1.profile.nickname` 塌缩成 `1`，字段名全丢）
 * - 按「路由 + 归一化字段路径」采样记录请求体，避免高频 400 撑爆日志
 * - 响应体回传 issue 列表，调用方无需查服务端日志即可定位字段
 */
import type { NodeLogger } from '@jl-org/log/node'
import type { Context } from 'hono'
import type { ZodError, ZodIssue } from 'zod'
import type { AppEnv } from '../../types'

/** 单次校验失败最多记录/回传的 issue 数，防止大 batch 刷爆日志 */
const MAX_ISSUES = 20

/** 请求体日志的最大字符数，超出截断 */
const MAX_BODY_CHARS = 2000

/** 同一种错误（路由 + 字段组合）全量记录请求体的最小间隔 */
const BODY_SAMPLE_INTERVAL_MS = 60_000

/** 采样表容量上限，超出后整表清空，避免长期驻留内存 */
const SAMPLE_TABLE_LIMIT = 500

export function createValidationHook({ logger }: ValidationHookOptions) {
  /** 错误种类 -> 上次记录请求体的时间戳 */
  const lastBodyLoggedAt = new Map<string, number>()

  return async (result: ValidationResult, c: Context<AppEnv>) => {
    if (result.success)
      return

    const requestId = c.get('requestId' as never) as string | undefined
    const { method, path } = c.req

    const issues = result.error!.issues.map(toIssueInfo)
    /** 去重后的字段名，是排查时最先要看的东西 */
    const fields = [...new Set(issues.map(i => i.field))]

    const sampleKey = `${method} ${path} ${fields.join('|')}`
    const shouldLogBody = takeBodySample(lastBodyLoggedAt, sampleKey)

    logger.warn(
      `参数校验失败 ${method} ${path} [${fields.join(', ')}]`,
      {
        meta: {
          requestId,
          method,
          path,
          fields,
          issueCount: issues.length,
          issues: issues.slice(0, MAX_ISSUES),
          ...(shouldLogBody && { input: await readInput(c, method) }),
        },
      },
    )

    return c.json({
      success: false,
      message: '参数校验失败',
      issues: issues.slice(0, MAX_ISSUES),
      issueCount: issues.length,
      data: null,
      requestId,
    }, 400)
  }
}

/** 展开单条 ZodIssue，同时保留原始路径与归一化字段名 */
function toIssueInfo(issue: ZodIssue): IssueInfo {
  return {
    path: issue.path.join('.'),
    field: normalizeField(issue.path),
    code: issue.code,
    message: issue.message,
  }
}

/**
 * 去掉数组下标，`1.profile.nickname` -> `profile.nickname`
 * 让同一字段在不同下标上的报错能聚合成一类
 */
function normalizeField(path: PropertyKey[]): string {
  return path
    .filter(seg => !/^\d+$/.test(String(seg)))
    .join('.')
}

/** 判断当前错误种类是否到了记录请求体的时机；顺带控制采样表大小 */
function takeBodySample(table: Map<string, number>, key: string): boolean {
  const now = Date.now()
  const last = table.get(key)

  if (last != null && now - last < BODY_SAMPLE_INTERVAL_MS)
    return false

  if (table.size >= SAMPLE_TABLE_LIMIT)
    table.clear()

  table.set(key, now)
  return true
}

/** 读取请求输入，body 做长度截断；读取失败不影响主流程 */
async function readInput(c: Context<AppEnv>, method: string): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {
    query: c.req.query(),
    params: c.req.param(),
  }

  if (!['POST', 'PUT', 'PATCH'].includes(method))
    return input

  const raw = await c.req.text().catch(() => '(unreadable)')

  input.body = raw.length > MAX_BODY_CHARS
    ? `${raw.slice(0, MAX_BODY_CHARS)}…(truncated, total ${raw.length} chars)`
    : raw

  return input
}

interface ValidationResult {
  success: boolean
  error?: ZodError
}

export interface ValidationHookOptions {
  logger: NodeLogger
}

interface IssueInfo {
  /** 原始路径，含数组下标，如 `1.profile.nickname` */
  path: string
  /** 归一化字段名，去掉数组下标，如 `profile.nickname` */
  field: string
  code: string
  message: string
}
