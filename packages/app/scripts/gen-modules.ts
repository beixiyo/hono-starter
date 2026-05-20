import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// src/modules 目录
const modulesDir = join(__dirname, '../src/modules')
const outputFile = join(modulesDir, 'auto-import.ts')

// 关键装饰器：包含这些字符串的文件会被自动导入
const DECORATOR_KEYWORDS = ['@Controller(', '@Service(']

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
      continue
    }

    if (!entry.name.endsWith('.ts'))
      continue

    if (entry.name.endsWith('.test.ts'))
      continue

    // 跳过 modules/index.ts 自身
    if (fullPath === join(modulesDir, 'index.ts'))
      continue

    files.push(fullPath)
  }

  return files
}

async function hasDecorator(filePath: string) {
  const content = await readFile(filePath, 'utf-8')
  return DECORATOR_KEYWORDS.some(keyword => content.includes(keyword))
}

async function generate() {
  const allFiles = await walk(modulesDir)
  const matched: string[] = []

  for (const file of allFiles) {
    if (await hasDecorator(file))
      matched.push(file)
  }

  matched.sort()

  const importLines = matched.map((absPath) => {
    const rel = relative(modulesDir, absPath).replace(/\\/g, '/').replace(/\.ts$/, '')
    return `import './${rel}'`
  })

  const banner = [
    '// 本文件由 scripts/generate-modules.ts 自动生成，请勿手动修改。',
    '// 根据 src/modules 目录下包含关键装饰器的文件自动收集并导入。',
    '',
  ]

  const content = [
    ...banner,
    ...importLines,
    '',
    'export const AUTO_IMPORTED_MODULES = true',
    '',
  ].join('\n')

  await mkdir(modulesDir, { recursive: true })
  await writeFile(outputFile, content, 'utf-8')

  // eslint-disable-next-line no-console
  console.log(`[generate-modules] 已生成 ${outputFile}，共导入 ${matched.length} 个模块`)
}

generate().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[generate-modules] 生成失败', error)
  process.exit(1)
})

