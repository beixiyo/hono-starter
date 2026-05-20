/** 用于存储路由元信息的 Symbol key */
export const ROUTES_KEY = Symbol('controller:routes')

/** 用于存储 controller 元信息的 Symbol key */
export const CONTROLLER_KEY = Symbol('controller:meta')

/**
 * 用于存储 handler 参数注入元信息
 * 结构: Record<handlerName, HandlerParamMeta>
 */
export const PARAM_META_KEY = Symbol('controller:paramMeta')
