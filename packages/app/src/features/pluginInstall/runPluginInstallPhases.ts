import type { PluginInstallOptions, PluginInstallProgress } from '@delta-comic/plugin'
import type { DownloadMessageBind } from '@delta-comic/ui'

export async function runPluginInstallPhases<T>(
  { createProgress, createLoading }: DownloadMessageBind,
  titles: Record<PluginInstallProgress['phase'], string>,
  describe: (progress: PluginInstallProgress) => string,
  operation: (options: PluginInstallOptions) => Promise<T>,
) {
  const phases = {
    resolve: createPhase(createProgress, titles.resolve),
    decode: createPhase(createLoading, titles.decode),
    persist: createPhase(createProgress, titles.persist),
  }
  await Promise.all(Object.values(phases).map(phase => phase.ready))

  try {
    const result = await operation({
      report(progress) {
        phases[progress.phase].update(describe(progress), progress.progress)
      },
    })
    Object.values(phases).forEach(phase => phase.complete.resolve())
    await Promise.all(Object.values(phases).map(phase => phase.line))
    return result
  } catch (error) {
    Object.values(phases).forEach(phase => phase.complete.reject(error))
    await Promise.allSettled(Object.values(phases).map(phase => phase.line))
    throw error
  }
}

function createPhase(
  create: DownloadMessageBind['createProgress'] | DownloadMessageBind['createLoading'],
  title: string,
) {
  const ready = Promise.withResolvers<void>()
  const complete = Promise.withResolvers<void>()
  let update = (_description: string, _progress?: number) => undefined
  const line = create(title, async state => {
    update = (description, progress) => {
      state.description = description
      if ('progress' in state) state.progress = progress ?? 0
    }
    ready.resolve()
    await complete.promise
  })
  return {
    complete,
    line,
    ready: ready.promise,
    update: (description: string, progress?: number) => update(description, progress),
  }
}