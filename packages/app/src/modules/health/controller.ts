import type { HandlerContextFor } from '@/core'
import { Controller } from 'di'
import { createRouteOptions, Get } from '@/core'

const healthRouteOptions = createRouteOptions({
  tags: ['健康检查'],
  summary: '健康检查',
  description: '用于检查服务是否正常运行，不使用全局 API 前缀',
  responses: {
    200: {
      description: '服务正常',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
  },
})

@Controller({
  basePath: '/health',
  useGlobalPrefix: false,
})
export class HealthController {
  @Get('/', healthRouteOptions)
  async health(
    _c: HandlerContextFor<typeof healthRouteOptions, 'get'>,
  ) {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    }
  }
}
