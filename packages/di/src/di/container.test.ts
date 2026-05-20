import { describe, expect, test } from 'bun:test'
import { Container } from './container'
import { Inject } from './inject'
import { applyToContainer, Injectable, Service } from './injectable'

describe('Container - 基本注册与解析', () => {
  test('register(Class) 应该注册为单例并能解析', () => {
    class Foo {
      value = Math.random()
    }

    const container = new Container()
    container.register(Foo)

    const a = container.resolve(Foo)
    const b = container.resolve(Foo)

    expect(a).toBeInstanceOf(Foo)
    expect(b).toBe(a)
  })

  test('register(Token, value) 应该返回常量值', () => {
    const TOKEN = Symbol('value-token')
    const VALUE = { x: 1 }

    const container = new Container()
    container.register(TOKEN, VALUE)

    const resolved = container.resolve<typeof VALUE>(TOKEN)
    expect(resolved).toBe(VALUE)
  })

  test('register(Token, factory) 默认缓存单例', () => {
    const TOKEN = Symbol('factory-token')

    let callCount = 0
    const container = new Container()
    container.register(TOKEN, () => {
      callCount += 1
      return { id: Math.random() }
    })

    const a = container.resolve<typeof container>(TOKEN as any)
    const b = container.resolve<typeof container>(TOKEN as any)

    expect(callCount).toBe(1)
    expect(a).toBe(b)
  })

  test('多参数 register({ token, useClass, scope }) 支持 transient', () => {
    const TOKEN = Symbol('class-token')

    class Bar {
      value = Math.random()
    }

    const container = new Container()
    container.register<Bar>({
      token: TOKEN,
      useClass: Bar,
      scope: 'transient',
    })

    const a = container.resolve<Bar>(TOKEN)
    const b = container.resolve<Bar>(TOKEN)

    expect(a).toBeInstanceOf(Bar)
    expect(b).toBeInstanceOf(Bar)
    expect(a).not.toBe(b)
  })

  test('多参数 register({ token, useFactory, scope }) 支持 transient', () => {
    const TOKEN = Symbol('factory-transient-token')

    class Baz {
      value = Math.random()
    }

    const container = new Container()
    container.register<Baz>({
      token: TOKEN,
      useFactory: () => new Baz(),
      scope: 'transient',
    })

    const a = container.resolve<Baz>(TOKEN)
    const b = container.resolve<Baz>(TOKEN)

    expect(a).toBeInstanceOf(Baz)
    expect(b).toBeInstanceOf(Baz)
    expect(a).not.toBe(b)
  })

  test('非法多参数配置应该抛出错误', () => {
    const TOKEN = Symbol('invalid-token')
    const container = new Container()

    expect(() =>
      container.register({
        token: TOKEN,
      } as any),
    ).toThrow()
  })

  test('未注册的 token resolve 应该抛出错误', () => {
    const TOKEN = Symbol('missing-token')
    const container = new Container()

    expect(() => container.resolve(TOKEN as any)).toThrow()
  })
})

describe('Container - 构造函数参数注入 (@Inject)', () => {
  test('create(Class) 应该根据 @Inject 注入依赖', () => {
    const FooToken = Symbol('foo-token')

    class FooService {
      value = 42
    }

    class BarController {
      constructor(
        @Inject(FooToken) public foo: FooService,
      ) {}
    }

    const container = new Container()
    container.register<FooService>({
      token: FooToken,
      useClass: FooService,
    })

    const instance = container.create(BarController)

    expect(instance).toBeInstanceOf(BarController)
    expect(instance.foo).toBeInstanceOf(FooService)
    expect(instance.foo.value).toBe(42)
  })

  test('resolve(Class) 也应该支持构造函数参数注入', () => {
    const FooToken = Symbol('foo-token-2')

    class FooService {
      value = 100
    }

    class BazController {
      constructor(
        @Inject(FooToken) public foo: FooService,
      ) {}
    }

    const container = new Container()
    container.register<FooService>({ token: FooToken, useClass: FooService })
    container.register<BazController>({ token: BazController, useClass: BazController })

    const a = container.resolve(BazController)
    const b = container.resolve(BazController)

    expect(a).toBeInstanceOf(BazController)
    expect(a.foo).toBeInstanceOf(FooService)
    expect(a.foo.value).toBe(100)
    /** 默认单例 */
    expect(a).toBe(b)
  })
})

describe('Injectable / Service / applyToContainer', () => {
  test('@Injectable() 默认以类自身作为 token 注册', () => {
    @Injectable()
    class MyService {
      value = 'ok'
    }

    const container = new Container()
    applyToContainer(container)

    const instance = container.resolve(MyService)
    expect(instance).toBeInstanceOf(MyService)
    expect(instance.value).toBe('ok')
  })

  test('派生装饰器如 @Service(Token) 应该按传入 token 注册', () => {
    const Token = Symbol('service-token')

    @Service(Token)
    class MyService {
      value = 'service'
    }

    const container = new Container()
    applyToContainer(container)

    const instance = container.resolve<typeof MyService>(Token as any)
    expect((instance as any).value).toBe('service')
  })

  test('applyToContainer 调用后应清空 pending，重复调用不会重复注册或抛错', () => {
    const Token = Symbol('multi-apply-token')

    @Injectable(Token)
    class MultiService {}

    const container = new Container()
    applyToContainer(container)

    /** 第二次调用应为 no-op，不抛错 */
    applyToContainer(container)

    const instance = container.resolve<typeof MultiService>(Token as any)
    expect(instance).toBeInstanceOf(MultiService)
  })
})
