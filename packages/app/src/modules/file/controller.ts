import type { FileService } from './service'
import { Controller, Form, Inject } from 'di'
import { createErrorSchema, createSuccessSchema, Post } from '@/core'
import { FileUploadSchema, UploadResponseSchema } from './schema'
import { FileServiceToken } from './tokens'

@Controller('/file')
export class FileController {
  constructor(
    @Inject(FileServiceToken) private readonly fileService: FileService,
  ) {}

  @Post('/upload', {
    tags: ['文件操作'],
    summary: '文件上传',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: FileUploadSchema,
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: createSuccessSchema(UploadResponseSchema) } }, description: '上传成功' },
      400: { content: { 'application/json': { schema: createErrorSchema() } }, description: '参数错误' },
    },
  })
  async upload(
    @Form('file') file: unknown,
  ) {
    if (file instanceof File) {
      const result = await this.fileService.saveFile(file)
      return {
        message: '文件上传成功',
        ...result,
      }
    }

    /** 业务错误：抛出异常，交给全局 errorHandler 统一包装成 jsonFail */
    throw new Error('未提供文件')
  }
}
