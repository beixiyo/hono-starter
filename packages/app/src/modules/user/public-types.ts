/**
 * user 模块对外暴露的 DTO 类型
 *
 * 新模块要给**仓库外**的消费方提供类型时，照抄这个文件的形状即可，
 * 然后在 `src/public-types.ts` 里补一行 re-export
 *
 * 两条硬约束：
 * - 只导出 `z.infer` 派生的**数据形状**，不要导出 schema 常量本身
 * - 不要引用 hono 自有类型（`RouteConfig` / `OpenAPIHono` / `createRoute` 的返回类型等）：
 *   产物会发射成合并 import `import { RouteConfig, z } from '@hono/zod-openapi'`，
 *   生成脚本改写不到它，兜底校验会直接失败
 */
export type { User } from './schema'
