export const CORE_CONFIG = {
  routesKey: Symbol('controller:routes'),
} as const

/** 全局 API 路由前缀，所有 Controller 会挂载在此路径下 */
export const API_BASE_PATH = '/api'

export const JWT_CONFIG = {
  /** Access Token 过期时间（单位 s），60 分钟 */
  accessExpSeconds: 60 * 60,
  /** Refresh Token 过期时间（单位 s），7 天 */
  refreshExpSeconds: 7 * 24 * 60 * 60,
  /** JWT 签名密钥 */
  get secret(): string {
    const secret = process.env.JWT_SECRET
    // if (!secret) {
    //   throw new Error('[JWT] 环境变量 JWT_SECRET 未设置，服务拒绝启动。请在 .env 中配置 JWT_SECRET')
    // }
    return secret || 'test-secret'
  },
} as const

/** JWT 校验时跳过认证的路径 */
export const JWT_PUBLIC_PATHS = new Set([
  '/api/auth/jwt/login',
])

export const OPENAPI_CONFIG = {
  version: '3.0.0',
  info: {
    version: '1.0.0',
    title: '模板项目 API',
    description: '',
  },
  docPath: '/doc',
  uiPath: '/ui',
} as const

export const SCALAR_CONFIG = {
  theme: 'deepSpace' as const,
  persistAuth: true,
  preferredSecurityScheme: '',
  httpBearerName: 'HTTP Bearer',
  /** 仅用于文档示例展示 */
  demoBearerToken: 'eyJhbGciO...',
} as const

export const MESSAGE_CONFIG = {
  successDefault: '成功',
  errorDefault: '请求错误',
  internalServerErrorDefault: 'Internal Server Error',
  notFoundPrefix: 'Not Found - ',
} as const

export const TEST_CONFIG = {
  origin: 'http://localhost',
} as const
