import { logger } from '@delta-comic/logger'
import { isEmpty, sortBy } from 'es-toolkit/compat'

import type { PluginConfig } from '@/plugin'

const pluginProbeLogger = logger.scoped('plugin:probe')

export const testApi = async (cfg: NonNullable<PluginConfig['api']>[string]) => {
  const forks = await cfg.forks()
  return await test(forks, cfg.test)
}

export const testResourceApi = (
  cfg: NonNullable<NonNullable<PluginConfig['resource']>['types']>[number],
) => {
  const forks = cfg.urls
  return test(forks, cfg.test)
}

const test = async (
  forks: string[],
  test: (url: string, signal: AbortSignal) => PromiseLike<any>,
) => {
  if (isEmpty(forks)) throw new Error('[plugin test] no fork found')
  const record: [url: string, result: false | number][] = []
  const abortController = new AbortController()
  try {
    await Promise.all(
      forks.map(async (_fork, index) => {
        try {
          const begin = Date.now()
          const stopTimeout = setTimeout(() => {
            abortController.abort()
          }, 10000)
          await test(_fork, abortController.signal)
          clearTimeout(stopTimeout)
          const end = Date.now()
          const time = end - begin
          record.push([_fork, time])
          pluginProbeLogger.debug('plugin endpoint probe succeeded', { index, latencyMs: time })
          abortController.abort()
        } catch {
          record.push([_fork, false])
          pluginProbeLogger.debug('plugin endpoint probe failed', { index })
        }
      }),
    )
  } catch (err) {
    pluginProbeLogger.debug('plugin endpoint probe aborted', err)
  }
  const result = sortBy(
    record.filter(v => v[1] != false),
    v => v[1],
  )[0]
  pluginProbeLogger.debug('plugin endpoint probe completed', { found: Boolean(result) })
  if (!result) {
    return ['', false] as [string, false]
  }
  return result
}