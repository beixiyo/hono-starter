import { describe, expect, test } from 'bun:test'
import { Body, Context, Form, getParamMeta, Next, Params, Query } from './decorators'

describe('参数注入装饰器 @Body / @Form / @Params / @Query', () => {
  test('@Params() 不传 key 时，元数据 key 为 undefined，适配器应返回整个 params 对象', () => {
    class C {
      get(_c: unknown, @Params() params: unknown) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta).toBeDefined()
    expect(meta!.length).toBeGreaterThanOrEqual(2)
    expect(meta![1]).toEqual({ source: 'params', key: undefined })
  })

  test('@Params("id") 传 key 时，元数据 key 为 "id"，适配器返回单个字段', () => {
    class C {
      get(_c: unknown, @Params('id') id: string) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta![1]).toEqual({ source: 'params', key: 'id' })
  })

  test('@Body() 不传 key 时元数据 key 为 undefined', () => {
    class C {
      post(_c: unknown, @Body() body: unknown) {}
    }
    const meta = getParamMeta(C as any, 'post')
    expect(meta![1]).toEqual({ source: 'body', key: undefined })
  })

  test('@Body("name") 传 key 时元数据 key 为 "name"', () => {
    class C {
      post(_c: unknown, @Body('name') name: string) {}
    }
    const meta = getParamMeta(C as any, 'post')
    expect(meta![1]).toEqual({ source: 'body', key: 'name' })
  })

  test('@Query() 不传 key 时元数据 key 为 undefined', () => {
    class C {
      get(_c: unknown, @Query() query: unknown) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta![1]).toEqual({ source: 'query', key: undefined })
  })

  test('@Query("page") 传 key 时元数据 key 为 "page"', () => {
    class C {
      get(_c: unknown, @Query('page') page: string) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta![1]).toEqual({ source: 'query', key: 'page' })
  })

  test('@Form() 不传 key 时元数据 key 为 undefined', () => {
    class C {
      post(_c: unknown, @Form() form: unknown) {}
    }
    const meta = getParamMeta(C as any, 'post')
    expect(meta![1]).toEqual({ source: 'form', key: undefined })
  })

  test('@Form("file") 传 key 时元数据 key 为 "file"', () => {
    class C {
      post(_c: unknown, @Form('file') file: unknown) {}
    }
    const meta = getParamMeta(C as any, 'post')
    expect(meta![1]).toEqual({ source: 'form', key: 'file' })
  })

  test('同一 handler 多参数：未装饰位置为 undefined，装饰位置按下标记录', () => {
    class C {
      handler(
        _c: unknown,
        @Params('id') id: string,
        @Query('page') page: string,
        @Body() body: unknown,
      ) {}
    }
    const meta = getParamMeta(C as any, 'handler')
    expect(meta).toBeDefined()
    expect(meta![0]).toBeUndefined()
    expect(meta![1]).toEqual({ source: 'params', key: 'id' })
    expect(meta![2]).toEqual({ source: 'query', key: 'page' })
    expect(meta![3]).toEqual({ source: 'body', key: undefined })
  })

  test('无参数装饰器时 getParamMeta 返回 undefined', () => {
    class C {
      get(_c: unknown) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta).toBeUndefined()
  })

  test('不存在的 handlerName 返回 undefined', () => {
    class C {
      get(_c: unknown, @Params('id') _id: string) {}
    }
    const meta = getParamMeta(C as any, 'nonexistent')
    expect(meta).toBeUndefined()
  })
})

describe('@Context() 与 @Next()', () => {
  test('@Context() 元数据 source 为 "context"，无 key', () => {
    class C {
      get(@Context() c: unknown) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta).toBeDefined()
    expect(meta![0]).toEqual({ source: 'context', key: undefined })
  })

  test('@Next() 元数据 source 为 "next"，无 key', () => {
    class C {
      get(_c: unknown, @Next() next: () => Promise<void>) {}
    }
    const meta = getParamMeta(C as any, 'get')
    expect(meta).toBeDefined()
    expect(meta![1]).toEqual({ source: 'next', key: undefined })
  })

  test('@Context() 与 @Next() 可与其它参数混用', () => {
    class C {
      handler(
        @Context() c: unknown,
        @Next() next: () => Promise<void>,
        @Query('page') page: string,
      ) {}
    }
    const meta = getParamMeta(C as any, 'handler')
    expect(meta).toBeDefined()
    expect(meta![0]).toEqual({ source: 'context', key: undefined })
    expect(meta![1]).toEqual({ source: 'next', key: undefined })
    expect(meta![2]).toEqual({ source: 'query', key: 'page' })
  })
})
