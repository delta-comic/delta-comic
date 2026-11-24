import { parsePluginManifest } from './manifest'

export const DEV_SERVER_LOADER_ID = 'dev-server'
export const DEV_SERVER_SOURCE_PREFIX = 'dev:'
export const DEV_MANIFEST_PATH = '/manifest.json'
export const DEV_ENTRY_PATH = '/index.js'
export const DEV_CSS_PATH = '/index.css'
export const DEV_UPDATE_EVENT = 'delta-comic:plugin-update'
export const DEV_SESSION_QUERY = 'dc-session'

export const parseDevServerPort = (input: string): number | undefined => {
  const match = new RegExp(`^${DEV_SERVER_SOURCE_PREFIX}(\\d+)$`).exec(input)
  if (!match) return undefined
  const port = Number(match[1])
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
}

export const devServerUrl = (port: number, path: string) =>
  `http://localhost:${port}${path.startsWith('/') ? path : `/${path}`}`

export const readDevManifest = async (port: number, signal: AbortSignal) => {
  const response = await fetch(devServerUrl(port, DEV_MANIFEST_PATH), {
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
  })
  if (!response.ok) throw new Error(`development manifest request failed: ${response.status}`)
  return parsePluginManifest(await response.json())
}