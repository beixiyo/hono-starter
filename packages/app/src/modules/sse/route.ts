import type { HandlerContextFor } from '@/core'
import { createRouteOptions } from '@/core'

export const sseRouteOptions = createRouteOptions({
  tags: ['实时通信'],
  summary: 'SSE 事件流接口',
  responses: {
    200: {
      description: 'SSE 流响应',
      content: {
        'text/event-stream': {
          schema: {
            type: 'string',
          },
        },
      },
    },
  },
})

export type SseRouteContext = HandlerContextFor<typeof sseRouteOptions, 'get'>
