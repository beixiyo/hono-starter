import type { WsRouteContext, WsRouteNext } from './route'
import { Controller } from 'di'
import { upgradeWebSocket } from 'hono/bun'
import { Get } from '@/core'
import { logger } from '@/core/logger'
import { wsRouteOptions } from './route'

@Controller('/ws')
export class WsController {
  // WebSocket：关闭自动包装，由 handler 自己返回 Response（101 协议升级）
  @Get('/', wsRouteOptions, { wrapResponse: false })
  ws(c: WsRouteContext, next: WsRouteNext) {
    return upgradeWebSocket((_c) => {
      return {
        onOpen(_event, ws) {
          logger.info('WebSocket connection opened')
          ws.send('Hello from Hono WebSocket!')
        },
        onMessage(event, ws) {
          logger.info(`Message from client: ${event.data}`)
          ws.send(`Echo: ${event.data}`)
        },
        onClose: () => {
          logger.info('WebSocket connection closed')
        },
      }
    })(c, next)
  }
}
