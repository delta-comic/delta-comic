import { isEmpty, sortBy } from 'es-toolkit/compat'

import type { PluginConfig } from '@/plugin'

export const testApi = async (cfg: NonNullable<PluginConfig['api']>[string]) => {
  const forks = await cfg.forks()
  return await test(forks, cfg.test)
}

export const testResourceApi = (
  cfg: NonNullable<NonNullable<PluginConfig['resource']>['types']>[number]
) => {
  const forks = cfg.urls
  return test(forks, cfg.test)
}

const test = async (
  forks: string[],
  test: (url: string, signal: AbortSignal) => PromiseLike<any>
) => {
  if (isEmpty(forks)) throw new Error('[plugin test] no fork found')
  const record: [url: string, result: false | number][] = []
  const abortController = new AbortController()
  try {
    await Promise.all(
      forks.map(async fork => {
        try {
          const begin = Date.now()
          const stopTimeout = setTimeout(() => {
            abortController.abort()
          }, 10000)
          await test(fork, abortController.signal)
          clearTimeout(stopTimeout)
          const end = Date.now()
          const time = end - begin
          record.push([fork, time])
          console.log(`[plugin test] fetch url ${fork} connected time ${time}ms`)
          abortController.abort()
        } catch {
          record.push([fork, false])
          console.log(`[plugin test] fetch url ${fork} can not connected`)
        }
      })
    )
  } catch (err) {
    console.log('[plugin test] fetch test aborted', err)
  }
  const result = sortBy(
    record.filter(v => v[1] != false),
    v => v[1]
  )[0]
  console.log(`[plugin test] fetch test done`, result)
  if (!result) {
    return ['', false] as [string, false]
  }
  return result
}