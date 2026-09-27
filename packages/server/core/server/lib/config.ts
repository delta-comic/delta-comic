import { syncCollectionNames, type SyncCollection } from './sync/collections'

export type ServerModuleKey =
  | 'admin'
  | 'auth'
  | 'health'
  | 'observability'
  | 'openapi'
  | 'plugins'
  | 'sync'

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
    key: 'admin',
    name: '管理 API',
    description: '独立管理员令牌保护的能力、就绪状态和运行指标控制面。',
    apiPrefix: '/api/admin',
    cloudflareBindings: ['DB', 'CF_VERSION_METADATA'],
    workerEnvVars: ['SERVER_ADMIN_TOKEN'],
    adminRoute: '/',
  },
  {
    key: 'auth',
    name: '鉴权服务',
    description: '用户、终端、access token 与 refresh token 生命周期配置。',
    apiPrefix: '/api/auth',
    cloudflareBindings: ['DB'],
    workerEnvVars: [
      'ACCESS_TOKEN_TTL_SECONDS',
      'REFRESH_TOKEN_TTL_SECONDS',
      'AUTH_PEPPER',
      'TOKEN_PEPPER',
    ],
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
    key: 'plugins',
    name: '服务端插件',
    description: '服务端插件注册、安装状态、依赖计划、任务与审计记录。',
    apiPrefix: '/api/admin/plugins',
    cloudflareBindings: ['DB'],
    workerEnvVars: ['SERVER_ADMIN_TOKEN'],
    adminRoute: '/plugins',
  },
  {
    key: 'observability',
    name: '可观测性',
    description: 'D1 就绪探针、固定资源计数、部署版本元数据和插件近期活动。',
    apiPrefix: '/api/admin/overview',
    cloudflareBindings: ['DB', 'CF_VERSION_METADATA'],
    workerEnvVars: ['SERVER_ADMIN_TOKEN', 'AUTH_PEPPER', 'TOKEN_PEPPER'],
    adminRoute: '/',
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
  adminPath: string
  apiBaseUrl: string
  docsPath: string
  openapiJsonPath: string
  healthPath: string
}

export const defaultServerRuntimeConfig = {
  adminPath: '/api/admin',
  apiBaseUrl: '',
  docsPath: '/api/openapi',
  openapiJsonPath: '/api/openapi/json',
  healthPath: '/api/health',
} as const satisfies ServerRuntimeConfig

export const serverCollections = syncCollectionNames

export type ServerCollection = SyncCollection