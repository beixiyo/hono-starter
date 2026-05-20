import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AppEnv } from '../types'
import { Scalar } from '@scalar/hono-api-reference'
import { OPENAPI_CONFIG, SCALAR_CONFIG } from '@/core'

export function registerOpenAPI(app: OpenAPIHono<AppEnv>) {
  app.doc(OPENAPI_CONFIG.docPath, {
    openapi: OPENAPI_CONFIG.version,
    info: OPENAPI_CONFIG.info,
  })

  app.get(OPENAPI_CONFIG.uiPath, Scalar({
    url: OPENAPI_CONFIG.docPath,
    theme: SCALAR_CONFIG.theme,
    persistAuth: SCALAR_CONFIG.persistAuth, // 持久化认证信息到 localStorage
    authentication: {
      preferredSecurityScheme: SCALAR_CONFIG.preferredSecurityScheme,
      securitySchemes: {
        [SCALAR_CONFIG.httpBearerName]: {
          token: SCALAR_CONFIG.demoBearerToken,
        },
      },
    },
  }))
}
