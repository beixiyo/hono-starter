import { z } from '@hono/zod-openapi'

export const UploadResponseSchema = z.object({
  message: z.string(),
  name: z.string(),
  url: z.string(),
}).openapi('UploadResponse')

export const FileUploadSchema = z.object({
  file: z.any().openapi({ type: 'string', format: 'binary', description: '待上传的文件' }),
})
