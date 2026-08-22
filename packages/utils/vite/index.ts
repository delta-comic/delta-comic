import { Parser } from 'acorn'
import { init, parse } from 'es-module-lexer'
import MagicString from 'magic-string'

const HOST_LIBRARIES_MODULE_ID = 'virtual:delta-comic/host-libraries'
const RESOLVED_HOST_LIBRARIES_MODULE_ID = `\0${HOST_LIBRARIES_MODULE_ID}`

/** Libraries physically bundled into the prebuilt UMD runtime. */
export const umdLibraryNames = {
  'vue': 'Vue',
  'naive-ui': 'Naive',
  'vue-router': 'VR',
  'vue-router/experimental': 'VRExperimental',
  'pinia': 'Pinia',
  '@pinia/colada': 'Pc',
} as const

/** Host-owned ESM modules exposed to plugins after the UMD runtime has loaded. */
export const hostExposedLibraryNames = {
  '@delta-comic/ui': 'DcUi',
  '@delta-comic/model': 'DcModel',
  '@delta-comic/plugin': 'DcPlugin',
  '@delta-comic/utils': 'DcUtils',
  '@delta-comic/db': 'DcDb',
} as const

export const externalLibraryNames = { ...umdLibraryNames, ...hostExposedLibraryNames } as const

export type ExternalLibKey = typeof externalLibraryNames

export type ExternalLib = {
  [K in keyof ExternalLibKey]: `window.$$lib$$.${ExternalLibKey[K]}`
}

const toExternalPaths = <T extends Record<string, string>>(libraries: T) =>
  Object.fromEntries(
    Object.entries(libraries).map(([moduleId, globalName]) => [
      moduleId,
      `window.$$lib$$.${globalName}`,
    ]),
  ) as { [K in keyof T]: `window.$$lib$$.${T[K]}` }

export const umdDepends = toExternalPaths(umdLibraryNames)
export const extendsDepends = toExternalPaths(externalLibraryNames) as ExternalLib

export interface ExposeHostLibrariesOptions {
  entry?: string
  libraries?: Record<string, string>
}

interface SharedRuntimePluginContext {
  error(error: string): never
  getModuleIds(): IterableIterator<string>
}

interface SharedRuntimePlugin {
  name: string
  enforce: 'post'
  config: () => { optimizeDeps: { exclude: string[] } }
  resolveId?: (id: string) => string | undefined
  load?: (id: string) => string | undefined
  transform: (
    this: SharedRuntimePluginContext,
    code: string,
    id: string,
  ) =>
    | Promise<{ code: string; map: ReturnType<MagicString['generateMap']> } | undefined>
    | undefined
  generateBundle: (this: SharedRuntimePluginContext) => void
}

type AcornName = { name?: string; value?: string }
type AcornSpecifier = { type: string; local: AcornName; imported?: AcornName; exported?: AcornName }
type AcornModuleDeclaration = {
  type: string
  exported?: AcornName | null
  specifiers?: AcornSpecifier[]
}

const normalizeModuleId = (id: string) => id.replaceAll('\\', '/').split('?')[0]
const readName = (node: AcornName | null | undefined) => node?.name ?? node?.value

const transformStaticImport = (
  raw: string,
  externalPath: string,
  reportError: (message: string) => never,
) => {
  const declaration = Parser.parse(raw, { ecmaVersion: 'latest', sourceType: 'module' }).body[0] as
    | AcornModuleDeclaration
    | undefined

  if (!declaration) return ''

  if (declaration.type === 'ExportAllDeclaration') {
    const exported = readName(declaration.exported)
    if (!exported) {
      reportError(
        '[delta-comic] `export *` cannot safely proxy a shared runtime module. Use explicit named exports.',
      )
    }
    return `export const ${exported} = ${externalPath}\n`
  }

  return (declaration.specifiers ?? [])
    .map(specifier => {
      const local = readName(specifier.local)
      if (!local) return ''

      if (specifier.type === 'ImportDefaultSpecifier') {
        return `const ${local} = ${externalPath}.default ?? ${externalPath}\n`
      }
      if (specifier.type === 'ImportNamespaceSpecifier') {
        return `const ${local} = ${externalPath}\n`
      }
      if (specifier.type === 'ImportSpecifier') {
        return `const ${local} = ${externalPath}.${readName(specifier.imported)}\n`
      }
      if (specifier.type === 'ExportSpecifier') {
        const exported = readName(specifier.exported)
        const source =
          local === 'default'
            ? `${externalPath}.default ?? ${externalPath}`
            : `${externalPath}.${local}`
        return exported === 'default'
          ? `export default ${source}\n`
          : `export const ${exported} = ${source}\n`
      }
      return ''
    })
    .join('')
}

const transformSharedRuntimeImports = async (
  context: SharedRuntimePluginContext,
  code: string,
  id: string,
  libraries: Record<string, string>,
  prefix = '',
) => {
  await init
  const [imports] = parse(code)
  let output: MagicString | undefined

  for (const imported of imports) {
    if (!imported.n) continue
    const externalPath = libraries[imported.n]
    if (!externalPath) continue

    output ??= new MagicString(code)
    if (imported.d >= 0) {
      output.overwrite(imported.ss, imported.se, `Promise.resolve(${externalPath})`)
      continue
    }

    const raw = code.slice(imported.ss, imported.se)
    const replacement = transformStaticImport(raw, externalPath, message => context.error(message))
    output.overwrite(imported.ss, imported.se, replacement)
  }

  if (!output && !prefix) return
  output ??= new MagicString(code)
  if (prefix) output.prepend(prefix)

  return {
    code: output.toString(),
    map: output.generateMap({ hires: true, includeContent: true, source: id }),
  }
}

const createHostLibrariesModule = () => {
  const entries = Object.entries(hostExposedLibraryNames)
  const imports = entries.map(
    ([moduleId], index) => `import * as library${index} from ${JSON.stringify(moduleId)}`,
  )
  const exposedLibraries = entries.map(
    ([, globalName], index) => `${JSON.stringify(globalName)}: library${index}`,
  )

  return `${imports.join('\n')}\n\nObject.assign(window.$$lib$$, {\n  ${exposedLibraries.join(',\n  ')},\n})\n`
}

const assertNoBundledRuntime = (context: SharedRuntimePluginContext) => {
  const runtimePackages = ['vue', 'naive-ui', 'vue-router', 'pinia', '@pinia/colada'] as const
  const bundledRuntime = [...context.getModuleIds()].find(id => {
    const normalizedId = id.replaceAll('\\', '/')
    return runtimePackages.some(packageName =>
      normalizedId.includes(`/node_modules/${packageName}/`),
    )
  })

  if (bundledRuntime) {
    context.error(
      `[delta-comic] Shared runtime package was bundled again instead of using the UMD instance: ${bundledRuntime}`,
    )
  }
}

/** Rewrites imports to read the namespace objects installed by the prebuilt UMD file. */
export const externalizeSharedRuntime = (
  libraries: Record<string, string> = extendsDepends,
): SharedRuntimePlugin => ({
  name: 'delta-comic:shared-runtime-externals',
  enforce: 'post',
  config: () => ({ optimizeDeps: { exclude: Object.keys(libraries) } }),
  transform(code, id) {
    return transformSharedRuntimeImports(this, code, id, libraries)
  },
  generateBundle() {
    assertNoBundledRuntime(this)
  },
})

/**
 * Makes the host consume the prebuilt UMD runtime and exposes host-owned ESM modules to plugins.
 *
 * Database and other application services intentionally stay in the host ESM graph because they
 * use top-level await, workers and import.meta. Their Vue-facing dependencies are still rewritten
 * to the UMD namespace by this plugin.
 */
export const exposeHostLibraries = ({
  entry,
  libraries,
}: ExposeHostLibrariesOptions): SharedRuntimePlugin => {
  if (!entry) return externalizeSharedRuntime(libraries)

  const normalizedEntry = normalizeModuleId(entry)

  return {
    name: 'delta-comic:host-libraries',
    enforce: 'post',
    config: () => ({ optimizeDeps: { exclude: Object.keys(umdDepends) } }),
    resolveId(id) {
      if (id === HOST_LIBRARIES_MODULE_ID) return RESOLVED_HOST_LIBRARIES_MODULE_ID
    },
    load(id) {
      if (id === RESOLVED_HOST_LIBRARIES_MODULE_ID) return createHostLibrariesModule()
    },
    transform(code, id) {
      const prefix =
        normalizeModuleId(id) === normalizedEntry
          ? `import ${JSON.stringify(HOST_LIBRARIES_MODULE_ID)}\n`
          : ''
      return transformSharedRuntimeImports(this, code, id, umdDepends, prefix)
    },
    generateBundle() {
      assertNoBundledRuntime(this)
    },
  }
}