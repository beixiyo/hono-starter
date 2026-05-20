import type { HandlerContextFor, HandlerNextFor } from '@/core'
import { createRouteOptions } from '@/core'

export const wsRouteOptions = createRouteOptions({
  tags: ['实时通信'],
  summary: 'WebSocket 连接端口',
  description: '通过此接口升级到 WebSocket 协议。支持 Echo 功能。请使用 ws:// 协议访问。',
  responses: {
    101: {
      description: '协议升级成功',
    },
  },
})

export type WsRouteContext = HandlerContextFor<typeof wsRouteOptions, 'get'>
export type WsRouteNext = HandlerNextFor<typeof wsRouteOptions, 'get'>
