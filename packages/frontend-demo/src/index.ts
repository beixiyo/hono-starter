import type { AppType } from 'app/rpc'
import type { ExecutionContext } from 'hono'
/**
 * 前端 RPC 类型演示
 * 验证从 app 包导入的 AppType 能提供完整的端到端类型推导
 */
import { hc } from 'hono/client'

const baseUrl = 'http://localhost:3005/api'

const client = hc<AppType>(baseUrl, {
  fetch: async (
    input: URL | RequestInfo,
    requestInit?: RequestInit | undefined,
    Env?: any,
    executionCtx?: ExecutionContext | undefined,
  ) => {
    const token = 'Your token'
    const headers = new Headers(requestInit?.headers ?? {})

    if (token)
      headers.set('Authorization', `Bearer ${token}`)

    const res = await fetch(input, {
      ...requestInit,
      headers,
    })

    if (res.status === 401) {
      // do something
    }

    return res
  },
})

async function demo() {
  // ✅ 登录 - 请求和响应都是强类型
  const loginRes = await client.auth.jwt.login.$post({
    json: { email: 'admin@example.com', password: 'password' },
  })
  const loginData = await loginRes.json()
  //    ^? { success: true, message: string, data: { token: string }, requestId?: string }
  console.log('token:', loginData.data.token)

  // ✅ 获取用户 - 路径参数有类型约束
  const getRes = await client.users[':id'].$get({
    param: { id: 'user_123' },
  })

  if (getRes.ok) {
    const userData = await getRes.json()
    //    ^? { success: true, message: string, data: { id, name, age }, requestId?: string }
    console.log('user:', userData.data.name)
  }

  // ✅ 创建用户 - body 根据 schema 自动校验
  const postRes = await client.users.$post({
    json: {
      id: 'new_user',
      name: 'test',
      age: 25,
    },
  })

  if (postRes.ok) {
    const created = await postRes.json()
    console.log('created:', created.data.id)
  }

  // ❌ 以下会触发类型错误（取消注释验证）：

  /** 错误的路径参数类型 */
  // client.users[':id'].$get({ param: { id: 123 } })

  /** 缺少必填字段 */
  // client.users.$post({ json: { id: 'x' } })

  /** 不存在的路由 */
  // client.nonexistent.$get({})
}

demo()
