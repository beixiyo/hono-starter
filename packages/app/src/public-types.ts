/**
 * 跨仓库 DTO 类型的唯一聚合入口
 *
 * 与 `src/rpc.ts` 对称：那边聚合路由供 workspace 内的 `hc<AppType>()` 使用，
 * 这边聚合 DTO 形状供**仓库外**的消费方使用（只需装 zod，不必引入 hono）
 *
 * 新增模块时手工补一行 —— 与 `rpc.ts` 要求手工补 `.openapi()` 的既有约定一致。
 * 之所以不做 `modules/*\/public-types.ts` 目录扫描：多入口会让共享类型各自展开成
 * 名义不兼容的副本，而扫描生成的 barrel 又必须进 git 才能被 `--check` 比对，
 * 是 churn 与冲突的固定来源
 */
export type * from './modules/user/public-types'
