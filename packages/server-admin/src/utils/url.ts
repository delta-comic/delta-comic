export const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const normalizeApiBaseUrl = (value: string): string => {
  const input = value.trim()
  if (!input) return ''
  const url = new URL(input)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API 地址仅支持 http 或 https 协议')
  }
  if (url.username || url.password) throw new Error('API 地址不能包含用户名或密码')
  if (url.search || url.hash) throw new Error('API 地址不能包含查询参数或片段')
  const pathname = trimTrailingSlash(url.pathname).replace(/\/api$/, '')
  url.pathname = pathname || '/'
  return trimTrailingSlash(url.toString())
}

export const joinUrl = (baseUrl: string, path: string): string => {
  const normalizedBase = normalizeApiBaseUrl(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}