const { readFileSync } = require('node:fs')
const { homedir } = require('node:os')
const { resolve } = require('node:path')
// @ts-check
const { deploy } = require('@jl-org/deploy')

/**
 * 命令执行的模式
 * @example node deploy.cjs test
 * @example node deploy.cjs prod
 * @type {'test' | 'prod'}
 */
const mode = process.argv.slice(2)[0] || 'test'

console.log(`部署模式: ${mode}`)

/**
 * @type {import('@jl-org/deploy').ConnectInfo[]}
 */
const connectInfos = []

if (mode === 'test') {
  connectInfos.push({
    host: 'YourHost',
    username: 'ubuntu',
    privateKey: readFileSync(resolve(homedir(), '.ssh/your_key.pem'), 'utf-8'),
    name: 'web-test',
  })
}
else if (mode === 'prod') {
  connectInfos.push({
    host: 'YourHost',
    username: 'ubuntu',
    privateKey: readFileSync(resolve(homedir(), '.ssh/your_key.pem'), 'utf-8'),
    name: 'web-prod',
  })
}

const timestamp = Date.now().toString()

/**
 * @type {Record<'test' | 'prod', Omit<import('@jl-org/deploy').DeployOpts, 'connectInfos'>>}
 */
const config = {
  test: {
    buildCmd: 'bun run -F app build:dev',
    distDir: resolve(__dirname, '../packages/app/dist'),
    zipPath: resolve(__dirname, '../packages/app/dist.tar.gz'),
    remoteZipPath: `/home/ubuntu/workspace/${timestamp}-dist.tar.gz`,
    remoteUnzipDir: '/home/ubuntu/workspace/web',
    remoteBackupDir: '/home/ubuntu/workspace/web-backup',
  },
  prod: {
    buildCmd: 'bun run -F app build:prod',
    distDir: resolve(__dirname, '../packages/app/dist'),
    zipPath: resolve(__dirname, '../packages/app/dist.tar.gz'),
    remoteZipPath: `/home/ubuntu/workspace/${timestamp}-dist.tar.gz`,
    remoteUnzipDir: '/home/ubuntu/workspace/web',
    remoteBackupDir: '/home/ubuntu/workspace/web-backup',
  },
}

const curConfig = config[mode]
deploy({
  ...curConfig,
  connectInfos,
})
