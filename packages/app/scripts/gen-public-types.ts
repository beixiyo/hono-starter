/**
 * 把 zod schema 派生的 DTO 类型打成单文件 `.d.ts`，供**仓库外**的消费方使用
 *
 * 与 `build:rpc` 是两条独立通道，不要混淆：
 * - `build:rpc` 导出 Hono 的 `AppType`，服务同一 workspace 内的 `hc<AppType>()`，
 *   消费方必须装 hono
 * - 本脚本导出纯 DTO 形状，消费方只需装 `zod`，适合独立仓库（不同 git 仓、
 *   不同包管理器 workspace，解析不到 `app` 这个包）
 *
 * 原理：`@hono/zod-openapi` 导出的 `z` 就是 zod 本体（zod 是它的 peerDependency，
 * 它只是调用 `extendZodWithOpenApi(z)` 后原样 re-export），而 `.openapi()` 是通过
 * `declare module 'zod'` 声明合并挂上去的、返回 `this` 的方法。因此 `.openapi()`
 * 对类型完全透明，产物里根本不会出现，把 import 从 `@hono/zod-openapi` 换成
 * `zod` 后类型逐字等价
 *
 * 用法：
 *   bun run -F app gen:public-types                       # 生成到 types/public-types.d.ts
 *   bun run -F app gen:public-types -- --out <绝对路径>     # 直接写进消费方仓库
 *   bun run -F app gen:public-types:check                 # 只校验产物是否过期（CI 用）
 *
 * 也可用环境变量 `APP_PUBLIC_TYPES_OUT` 指定输出路径，便于在本机固化消费方仓库位置
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** packages/app 根目录，所有相对路径以它为基准 */
const APP_ROOT = resolve(__dirname, '..')

const DEFAULT_ENTRY = 'src/public-types.ts'
const DEFAULT_PROJECT = 'tsconfig.json'
const DEFAULT_OUT = 'types/public-types.d.ts'

/** 消费方只需装这个包，无需 @hono/zod-openapi */
const ZOD_IMPORT = 'zod'

/**
 * 只改写「具名绑定恰好只有 `z`」的那条 import
 *
 * 宽容 `import type`、单双引号、有无分号、任意空白与末尾逗号，但**刻意不放行**
 * 合并 import（如 `import { RouteConfig, z } from '@hono/zod-openapi'`）——
 * `RouteConfig` 在 zod 里不存在，改写过去只会产出编译不了的产物。这类情况留给
 * 下面的兜底校验直接失败
 */
const SOLE_Z_IMPORT_RE
  = /^(\s*import\s+(?:type\s+)?\{\s*z(?:\s+as\s+\w+)?\s*,?\s*\}\s+from\s+)(['"])@hono\/zod-openapi\2(\s*;?\s*)$/

const HEADER = `/**
 * 公共 DTO 类型 —— 自动生成，请勿手改
 *
 * 来源：packages/app/${DEFAULT_ENTRY}
 * 生成：\`bun run -F app gen:public-types\`
 *
 * 与后端 zod schema 同源：字段名、可选性、枚举取值都由 schema 推导，后端改了
 * 这里重新生成即可，不一致会在消费方 tsc 阶段直接暴露
 *
 * 两点约束：
 * - 消费方需安装 **zod ^4**（产物用到 \`z.core.$strip\`，v3 没有该命名空间）
 * - 产物只有**形状**，运行时校验规则不保留（\`z.string().min(3)\` 只剩 \`z.ZodString\`）
 */

`

function main(): void {
  const options = parseArgs(process.argv.slice(2))

  const generated = generateBundle(options)
  const rewritten = rewriteZodImport(generated)

  assertNoHonoReference(rewritten)

  const content = HEADER + rewritten

  if (options.check) {
    checkAgainstExisting(options.out, content)
    return
  }

  writeAtomically(options.out, content)

  console.log(`[gen-public-types] 已生成 ${options.out}`)
}

/** 打包到系统临时目录：校验没过就不该在目标位置留下任何痕迹 */
function generateBundle(options: Options): string {
  const staging = join(tmpdir(), `app-public-types-${process.pid}.d.ts`)

  try {
    execFileSync(
      'bun',
      ['x', 'dts-bundle-generator', '-o', staging, options.entry, '--project', options.project, '--no-check'],
      { cwd: APP_ROOT, stdio: 'inherit' },
    )

    return readFileSync(staging, 'utf-8')
  }
  finally {
    rmSync(staging, { force: true })
  }
}

function rewriteZodImport(generated: string): string {
  return generated
    .split('\n')
    .map(line => line.replace(SOLE_Z_IMPORT_RE, `$1'${ZOD_IMPORT}'$3`))
    .join('\n')
}

/**
 * 兜底校验：产物一旦仍引用 @hono，说明消费方光装 zod 不够用
 *
 * 最常见的触发原因是入口文件（间接）导出了 hono 自有类型（`RouteConfig`、
 * `OpenAPIHono` 等），产物会发射成合并 import，上面的改写刻意不碰它。
 * 与其让消费方在 tsc 阶段撞一堆解析错误，不如在这里响亮地失败
 */
function assertNoHonoReference(content: string): void {
  if (!content.includes('@hono'))
    return

  console.error('[gen-public-types] 产物仍引用 @hono，消费方仅装 zod 将无法编译：')

  content
    .split('\n')
    .forEach((line, index) => {
      if (line.includes('@hono')) {
        console.error(`  ${index + 1}: ${line.trim()}`)
      }
    })

  console.error('\n  多半是入口文件导出了 hono 自有类型。公共类型入口只应导出 zod schema 的 `z.infer` 派生形状')
  process.exit(1)
}

/**
 * 漂移检测：重新生成的内容与目标位置的产物不一致就失败
 *
 * schema 改了却没重新生成，消费方的类型会静默过期——本机制号称要消灭的正是
 * 这种「编译期发现不了、上线才炸」的失败模式，没有这道检查就等于把它挪了个位置
 *
 * 注意默认输出目录 `types/` 已被 gitignore，那只是本地构建产物、没有基准可比。
 * 真正需要检测漂移的是**消费方仓库里已提交的那份**，CI 里应当带上 `--out`：
 *   bun run -F app gen:public-types:check -- --out <消费方仓库里的产物路径>
 */
function checkAgainstExisting(outPath: string, expected: string): void {
  if (!existsSync(outPath)) {
    console.error(
      `[gen-public-types] 产物不存在：${outPath}\n`
      + `  校验消费方仓库的产物请带上 --out <该产物的绝对路径>\n`
      + `  仅本地首次生成则先运行 bun run -F app gen:public-types`,
    )
    process.exit(1)
  }

  /** 归一化换行，避免 Windows checkout 把 CRLF 误判成漂移 */
  const actual = readFileSync(outPath, 'utf-8').replace(/\r\n/g, '\n')

  if (actual === expected.replace(/\r\n/g, '\n')) {
    console.log(`[gen-public-types] 产物是最新的：${outPath}`)
    return
  }

  console.error(
    `[gen-public-types] 产物已过期：${outPath}\n`
    + `  已提交 sha256: ${sha256(actual)}\n`
    + `  重新生成 sha256: ${sha256(expected)}\n`
    + `  请运行 bun run -F app gen:public-types 并提交产物`,
  )
  process.exit(1)
}

/** 先写同目录临时文件再 rename：中途失败不会留下半个产物 */
function writeAtomically(outPath: string, content: string): void {
  mkdirSync(dirname(outPath), { recursive: true })

  const staging = `${outPath}.${process.pid}.tmp`

  try {
    writeFileSync(staging, content, 'utf-8')
    renameSync(staging, outPath)
  }
  catch (error) {
    rmSync(staging, { force: true })
    throw error
  }
}

function parseArgs(argv: string[]): Options {
  const check = argv.includes('--check')

  return {
    check,
    entry: readFlag(argv, '--entry') ?? DEFAULT_ENTRY,
    project: readFlag(argv, '--project') ?? DEFAULT_PROJECT,
    out: resolve(APP_ROOT, readFlag(argv, '--out') ?? process.env.APP_PUBLIC_TYPES_OUT ?? DEFAULT_OUT),
  }
}

function readFlag(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  if (index === -1)
    return undefined

  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error(`[gen-public-types] ${flag} 缺少取值`)
    process.exit(1)
  }

  return value
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

main()

type Options = {
  /** 只校验产物是否过期，不写盘 */
  check: boolean
  /** 类型入口，相对 packages/app */
  entry: string
  /** dts-bundle-generator 使用的 tsconfig，相对 packages/app */
  project: string
  /** 产物绝对路径 */
  out: string
}
