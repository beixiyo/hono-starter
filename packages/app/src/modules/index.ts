function shouldLoadTsModule(file: string) {
  if (!file.endsWith('.ts'))
    return false

  const bannedSuffixes = ['.d.ts', 'index.ts', '.test.ts']
  return !bannedSuffixes.some(suffix => file.endsWith(suffix))
}

async function tryLoadFromTs() {
  const glob = new Bun.Glob('**/*.ts')
  let loadedAny = false

  for await (const file of glob.scan(import.meta.dir)) {
    if (!shouldLoadTsModule(file))
      continue

    // bun dev：这里能扫到 controller.ts / service.ts 等，动态导入后 DI 能收集到装饰器
    await import(`./${file}`)
    loadedAny = true
  }

  return loadedAny
}

export async function loadModules() {
  // 1) 优先尝试从 .ts 动态加载（dev 环境，有热更新，文件变更可立即生效）
  const loadedFromTs = await tryLoadFromTs()
  if (loadedFromTs)
    return

  // 2) 如果当前目录没有任何 .ts 模块（典型是 dist 目录），则走预生成的静态导入
  /** 这样 Bun 打包后的 auto-import.js 一定会被保留，避免被 tree-shake。 */
  await import('./auto-import')
}
