export const DEV_SERVER_LOADER_ID = 'dev-server'
export const DEV_SERVER_SOURCE_PREFIX = 'dev:'
export const DEV_MANIFEST_PATH = '/manifest.json'
export const DEV_ENTRY_PATH = '/index.js'
export const DEV_CSS_PATH = '/index.css'
export const DEV_HMR_PATH = '/__delta-comic__/hmr'
export const DEV_PLUGIN_HMR_EVENT = 'delta-comic:plugin-hmr'

export const parseDevServerPort = (input: string): number | undefined => {
  const match = new RegExp(`^${DEV_SERVER_SOURCE_PREFIX}(\\d+)$`).exec(input)
  if (!match) return undefined
  const port = Number(match[1])
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
}

export const devServerUrl = (port: number, path: string) =>
  `http://localhost:${port}${path.startsWith('/') ? path : `/${path}`}`