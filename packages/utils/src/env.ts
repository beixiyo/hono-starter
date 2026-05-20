export function isDev() {
  if (typeof globalThis.process !== 'undefined') {
    return globalThis.process.env.NODE_ENV === 'development'
  }

  return import.meta.env.MODE === 'development'
}

export function isProd() {
  if (typeof globalThis.process !== 'undefined') {
    return globalThis.process.env.NODE_ENV === 'production'
  }

  return import.meta.env.MODE === 'production'
}
