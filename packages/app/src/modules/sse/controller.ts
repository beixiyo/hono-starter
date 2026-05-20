import type { SseRouteContext } from './route'
import { Context, Controller } from 'di'
import { streamSSE } from 'hono/streaming'
import { Get } from '@/core'
import { sseRouteOptions } from './route'

@Controller('/sse')
export class SseController {
  // SSE 接口：关闭自动包装，由 handler 自己返回 Response
  @Get('/events', sseRouteOptions, { wrapResponse: false })
  async events(@Context() c: SseRouteContext) {
    let count = 0
    return streamSSE(c, async (stream) => {
      let id = 0

      while (count < 5) {
        const message = `It is ${new Date().toISOString()} ${count++}`
        await stream.writeSSE({
          data: message,
          event: 'time-update',
          id: String(id++),
        })
        await stream.sleep(100)
      }
    })
  }
}
