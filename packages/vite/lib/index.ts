import type { PluginArchiveDB } from '@delta-comic/db'
import { extendsDepends } from '@delta-comic/utils'
import { merge } from 'es-toolkit'
import { viteExternalsPlugin as external } from 'vite-plugin-externals'
import monkey from 'vite-plugin-monkey'

const externals = Object.fromEntries(
  Object.entries(extendsDepends).map(([key, val]) => [key, val.split('.').slice(1)])
)

/** vite插件，自动配置了库的外部化与脚本头 */
export const deltaComic = (
  config: {
    name: string
    displayName: string
    version: string
    author?: string
    description: string
    /** 通过语义化版本号描述core支持版本，通过`semver.satisfies`判定，所有的`>=`会替换为`^`，除非`lockCoreVersion为`true` */
    supportCoreVersion: string
    /** 如果为`true`，则`supportCoreVersion`的`>=`不会替换为`^` */
    lockCoreVersion?: boolean
    /** @default ['core'] */
    require?: ({ id: string; download?: string } | string)[]
    /** @default 'src/main.ts' */
    entry?: string
  },
  command: 'build' | 'serve',
  packageJson: { dependencies: Record<string, string>; devDependencies: Record<string, string> }
): any => {
  const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  const needExternalDepends = Object.fromEntries(
    Object.entries(extendsDepends).filter(([key]) => key in allDependencies)
  )

  const result = [
    monkey({
      entry: config.entry ?? 'src/main.ts',
      userscript: {
        name: { display: config.displayName, id: config.name },
        version: `${config.version}/${config.supportCoreVersion}/${!!config.lockCoreVersion}`,
        author: config.author,
        description: config.description,
        require: ['core', ...(config.require ?? [])].map(v => {
          if (typeof v == 'string') return `dc|${v}:`
          return `dc|${v.id}:${v.download ?? ''}`
        })
      },
      build: { externalGlobals: command == 'serve' ? {} : needExternalDepends },
      server: { mountGmApi: false, open: false, prefix: false }
    }),
    external(externals, { disableInServe: false })
  ]
  return result
}

export const deltaComicPlus = (meta: PluginArchiveDB.Meta, command: 'build' | 'serve'): any => {
  const plugin = {
    name: 'delta-comic-helper',
    config(config: any) {
      return merge(config, {
        build: {
          lib: {
            entry: './src/main.ts',
            fileName: 'index',
            cssFileName: 'index',
            name: `$$lib$$.__DcPlugin__${meta.name.id.replace('-', '_')}__`,
            formats: ['es']
          },
          rollupOptions: {}
        }
      })
    },
    generateBundle() {
      ;(this as any).emitFile({
        type: 'asset', // 指定类型为资源文件
        fileName: 'manifest.json', // 输出的文件名
        source: JSON.stringify(meta, null, 2) // 将 meta 对象转换为格式化的 JSON 字符串
      })
    }
  }
  return command == 'build'
    ? ([external(externals, { disableInServe: false }), plugin] as any)
    : deltaComic(
        {
          description: meta.description,
          displayName: meta.name.display,
          name: meta.name.id,
          supportCoreVersion: meta.version.supportCore,
          version: meta.version.plugin,
          author: meta.author,
          entry: 'src/main.ts',
          require: meta.require
        },
        command,
        { dependencies: extendsDepends, devDependencies: extendsDepends }
      )
}