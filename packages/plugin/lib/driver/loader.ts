import { db, type PluginArchiveDB } from '@delta-comic/db'
import { Mutex } from 'es-toolkit'
import { sortBy } from 'es-toolkit/compat'
import { ref, type Ref } from 'vue'

import type { PluginConfigFactory } from '@/plugin'

import { bootPlugin } from './booter'
import { coreName } from './core'
import type { PluginLoader } from './init/utils'

const rawLoaders = import.meta.glob<PluginLoader>('./init/loader/*_*.ts', {
  eager: true,
  import: 'default',
})
export const loaders = sortBy(Object.entries(rawLoaders), ([fname]) =>
  // oxlint-disable-next-line no-useless-escape
  Number(fname.match(/[\d\.]+(?=_)/)?.[0]),
).map(v => v[1])

const loadLocks = <Record<string, Mutex>>{}
const getLoadLock = (pluginName: string) => (loadLocks[pluginName] ??= new Mutex())

/** 加载单个插件：获取 config factory → bootPlugin，全程在锁内 */
const bootConfig = async (
  configFactory: PluginConfigFactory,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  const cfg = configFactory({ safe: true })
  info.value[cfg.name] = {
    progress: { status: 'wait', stepsIndex: 0 },
    steps: [{ name: '等待', description: '插件载入中' }],
  }
  await bootPlugin(cfg, info)
}

export const loadPlugin = async (
  meta: PluginArchiveDB.Archive,
  info: Ref<Record<string, PluginLoadingInfo>>,
) => {
  console.log(`[plugin bootPlugin] booting name "${meta.pluginName}"`)
  const lock = getLoadLock(meta.pluginName)

  const loader = loaders.find(v => v.name === meta.loaderName)
  if (!loader) throw new Error(`未找到加载器 "${meta.loaderName}"，插件: ${meta.pluginName}`)

  try {
    await lock.acquire()
    const configFactory = await loader.load(meta)
    if (configFactory) await bootConfig(configFactory, info)
  } finally {
    lock.release()
  }
  console.log(`[plugin bootPlugin] boot name done "${meta.pluginName}"`)
}

/**
 * 通过 Kahn 算法对插件进行拓扑排序，返回层级划分结果和未入队的循环引用插件。
 * 时间复杂度 O(V+E)，其中 V 为插件数，E 为依赖边数。
 */
function buildTopologicalOrder(
  plugins: PluginArchiveDB.Archive[],
  coreName: string,
): { levels: PluginArchiveDB.Archive[][]; cyclic: PluginArchiveDB.Archive[] } {
  const nameToPlugin = new Map(plugins.map(p => [p.pluginName, p]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const p of plugins) {
    // 过滤掉对 core 的依赖（core 已在插件加载前初始化完毕，不需要参与拓扑排序）
    const deps = p.meta.require.filter(d => d.id !== coreName)
    inDegree.set(p.pluginName, deps.length)
    for (const d of deps) {
      if (!adjacency.has(d.id)) adjacency.set(d.id, [])
      adjacency.get(d.id)!.push(p.pluginName)
    }
  }

  // 初始入度为 0 的节点（无依赖或仅依赖 core）
  const queue: string[] = []
  for (const [name, deg] of inDegree) {
    if (deg === 0) queue.push(name)
  }

  const levels: PluginArchiveDB.Archive[][] = []
  while (queue.length > 0) {
    const levelSize = queue.length
    const level: PluginArchiveDB.Archive[] = []
    for (let i = 0; i < levelSize; i++) {
      const name = queue.shift()!
      level.push(nameToPlugin.get(name)!)
      for (const dependent of adjacency.get(name) ?? []) {
        const newDeg = inDegree.get(dependent)! - 1
        inDegree.set(dependent, newDeg)
        if (newDeg === 0) queue.push(dependent)
      }
    }
    levels.push(level)
  }

  // 剩余入度 > 0 的即为循环引用插件
  const cyclic = plugins.filter(p => inDegree.get(p.pluginName)! > 0)
  return { levels, cyclic }
}

/**
 * 从循环引用插件集合中查找具体的循环路径（用于友好报错）
 */
function findCyclePaths(cyclic: PluginArchiveDB.Archive[], coreName: string): string[][] {
  const cyclicNames = new Set(cyclic.map(p => p.pluginName))
  const nameToDeps = new Map(
    cyclic.map(p => [p.pluginName, p.meta.require.filter(d => d.id !== coreName).map(d => d.id)]),
  )
  const paths: string[][] = []

  for (const startName of cyclicNames) {
    const visited = new Set<string>()
    const path: string[] = []

    function dfs(current: string): boolean {
      if (visited.has(current)) {
        const startIdx = path.indexOf(current)
        if (startIdx !== -1) {
          paths.push([...path.slice(startIdx), current])
        }
        return true
      }
      visited.add(current)
      path.push(current)

      const deps = nameToDeps.get(current) ?? []
      for (const depName of deps) {
        if (dfs(depName)) return true
      }
      path.pop()
      return false
    }

    dfs(startName)
  }

  return paths
}

/** 构造 core 伪 Archive，使 core 可走统一 loader 管道 */
function createCorePseudoArchive(): PluginArchiveDB.Archive {
  return {
    pluginName: coreName,
    loaderName: coreName,
    installerName: '',
    enable: true,
    installInput: '',
    displayName: '系统核心',
    meta: {
      name: { display: 'Core', id: coreName },
      version: { plugin: '', supportCore: '' },
      author: '',
      description: '',
      require: [],
    },
  }
}

export type PluginLoadingInfo = {
  steps: { name: string; description: string }[]
  progress: {
    errorReason?: string
    stepsIndex: number
    status: 'wait' | 'process' | 'error' | 'done'
  }
}

export const loadAllPlugins = () => {
  const progress = ref<Record<string, PluginLoadingInfo>>({})

  const promise = (async () => {
    // 1. 通过 core loader 获取 config factory 并 boot
    const coreLoader = loaders[0]
    const coreConfigFactory = await coreLoader.load(createCorePseudoArchive())
    if (coreConfigFactory) await bootConfig(coreConfigFactory, progress)

    const plugins = await db.selectFrom('plugin').where('enable', 'is', true).selectAll().execute()

    // 2. 通过 Kahn 拓扑排序将插件分层
    const { levels, cyclic } = buildTopologicalOrder(plugins, coreName)

    // 3. 检测循环引用，输出依赖路径
    if (cyclic.length > 0) {
      const paths = findCyclePaths(cyclic, coreName)
      const names = cyclic.map(v => v.pluginName).join(', ')
      const pathStrs = paths.map(p => p.join(' → ')).join('\n')
      throw new Error(`插件循环引用: ${names}\n循环路径:\n${pathStrs}`)
    }

    // 4. 按层级加载，失败时终止后续
    for (const level of levels) {
      const results = await Promise.allSettled(level.map(p => loadPlugin(p, progress)))

      for (const [i, r] of results.entries()) {
        if (r.status === 'rejected') {
          const pluginName = level[i].pluginName
          const reason = r.reason instanceof Error ? r.reason.message : String(r.reason)
          console.error(`[plugin] 加载失败: ${pluginName}`, r.reason)

          progress.value[pluginName].progress = {
            ...progress.value[pluginName].progress,
            errorReason: reason,
            status: 'error',
          }
        }
      }
    }

    console.log('[plugin bootPlugin] all load done')
  })()

  return Object.assign(promise, progress)
}