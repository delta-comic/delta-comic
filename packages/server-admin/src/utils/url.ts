export const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const joinUrl = (baseUrl: string, path: string) => {
  const normalizedBase = trimTrailingSlash(baseUrl)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}
