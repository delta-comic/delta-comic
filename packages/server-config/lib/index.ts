export type ServerModuleKey = 'auth' | 'sync' | 'openapi' | 'health'

export interface ServerModuleDefinition {
  key: ServerModuleKey
  name: string
  description: string
  apiPrefix: string
  cloudflareBindings: readonly string[]
  workerEnvVars: readonly string[]
  adminRoute: string
}

export const serverModules = [
  {
    key: 'health',
    name: '运行状态',
    description: 'Worker 健康检查、部署连通性和管理面板 API 探测。',
    apiPrefix: '/api/health',
    cloudflareBindings: [],
    workerEnvVars: [],
    adminRoute: '/',
  },
  {
    key: 'auth',
    name: '鉴权服务',
    description: '用户、终端、access token 与 refresh token 生命周期配置。',
    apiPrefix: '/api/auth',
    cloudflareBindings: ['DB'],
    workerEnvVars: ['ACCESS_TOKEN_TTL_SECONDS', 'REFRESH_TOKEN_TTL_SECONDS', 'AUTH_PEPPER', 'TOKEN_PEPPER'],
    adminRoute: '/modules/auth',
  },
  {
    key: 'sync',
    name: '同步服务',
    description: '本地 SQLite 与 D1 的 snapshot/push/pull 同步协议配置。',
    apiPrefix: '/api/sync',
    cloudflareBindings: ['DB'],
    workerEnvVars: ['SYNC_MAX_PUSH_OPS', 'SYNC_MAX_PULL_CHANGES'],
    adminRoute: '/modules/sync',
  },
  {
    key: 'openapi',
    name: 'OpenAPI',
    description: '服务端公开接口文档和 schema 入口。',
    apiPrefix: '/api/openapi',
    cloudflareBindings: [],
    workerEnvVars: [],
    adminRoute: '/openapi',
  },
] as const satisfies readonly ServerModuleDefinition[]

export interface ServerRuntimeConfig {
  apiBaseUrl: string
  docsPath: string
  openapiJsonPath: string
  healthPath: string
}

export const defaultServerRuntimeConfig = {
  apiBaseUrl: '',
  docsPath: '/api/openapi',
  openapiJsonPath: '/api/openapi/json',
  healthPath: '/api/health',
} as const satisfies ServerRuntimeConfig

export const serverCollections = [
  'itemStore',
  'favouriteCard',
  'favouriteItem',
  'history',
  'recentView',
  'subscribe',
  'config',
] as const

export type ServerCollection = (typeof serverCollections)[number]
