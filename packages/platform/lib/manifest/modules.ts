import semver from 'semver'
import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

export const hostModuleIds = [
  'vue',
  'cordis',
  'pinia',
  '@pinia/colada',
  'vue-router',
  'vue-router/experimental',
  'naive-ui',
  '@delta-comic/client',
] as const

export const modulePackage = (id: string) =>
  id
    .split('/')
    .slice(0, id.startsWith('@') ? 2 : 1)
    .join('/')

const packagePattern = '^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$'
const range = Type.String({ minLength: 1 })
const paths = Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })

const schema = Type.Object(
  {
    formatVersion: Type.Literal(2),
    id: Type.String({ maxLength: 64, pattern: '^[a-z0-9][a-z0-9._-]*$' }),
    name: Type.String({ minLength: 1 }),
    package: Type.String({ pattern: packagePattern }),
    version: Type.String(),
    supportCoreVersion: range,
    author: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    icon: Type.Optional(Type.String()),
    script: Type.String(),
    exports: paths,
    externals: paths,
    pluginPeers: Type.Record(Type.String(), range),
    resources: Type.Array(
      Type.Object(
        {
          path: Type.String(),
          mimeType: Type.String({ minLength: 1 }),
          integrity: Type.String({ pattern: '^sha256-[A-Za-z0-9+/]{43}=$' }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
)

export type ModuleManifest = Static<typeof schema>

export function isPublicSubpath(path: string) {
  return (
    path === '.' ||
    (path.startsWith('./') &&
      path
        .slice(2)
        .split('/')
        .every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part)))
  )
}

export function parseModuleManifest(input: unknown): ModuleManifest {
  if (!Value.Check(schema, input)) throw new TypeError('invalid format 2 plugin manifest')
  const fail = (message: string): never => {
    throw new TypeError(`${input.id}: ${message}`)
  }
  const reserved = new Set(['core', ...hostModuleIds.map(modulePackage)])
  if (reserved.has(input.package) || reserved.has(input.id))
    fail('reserved package or installation id')
  if (!semver.valid(input.version) || !semver.validRange(input.supportCoreVersion))
    fail('invalid version or host range')
  for (const path of input.exports) if (!isPublicSubpath(path)) fail(`invalid export: ${path}`)
  for (const [peer, expected] of Object.entries(input.pluginPeers)) {
    if (
      !new RegExp(packagePattern).test(peer) ||
      peer === input.package ||
      reserved.has(peer) ||
      !semver.validRange(expected)
    )
      fail(`invalid peer: ${peer} ${expected}`)
  }
  const hosts = new Set<string>(hostModuleIds)
  for (const request of input.externals) {
    if (hosts.has(request)) continue
    const peer = modulePackage(request)
    if (
      !Object.hasOwn(input.pluginPeers, peer) ||
      !isPublicSubpath('.' + request.slice(peer.length))
    )
      fail(`undeclared external: ${request}`)
  }
  const resources = new Set<string>()
  for (const { path } of input.resources) {
    if (
      !isPublicSubpath('./' + path) ||
      resources.has(path) ||
      ['manifest.json', 'plugin.zip'].includes(path)
    )
      fail(`invalid or duplicate resource: ${path}`)
    resources.add(path)
  }
  if (!resources.has(input.script)) fail(`missing registration script: ${input.script}`)
  return input
}