import type { PluginAuthGateway, User } from '@delta-comic/plugin'
import { createForm } from '@delta-comic/ui'
import { PageWebviewAuth } from '@delta-comic/utils'
import { NSelect } from 'naive-ui'
import { h, ref } from 'vue'

import { translateText } from '@/i18n'
import { localizeForm } from '@/i18n/pluginText'

const raceAbort = <T>(operation: Promise<T>, signal: AbortSignal) => {
  if (signal.aborted) return Promise.reject<T>(signal.reason)
  let removeAbortListener = () => {}
  const aborted = new Promise<never>((_, reject) => {
    const abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    removeAbortListener = () => signal.removeEventListener('abort', abort)
  })
  return Promise.race([operation, aborted]).finally(removeAbortListener)
}

const chooseSelection = async (
  plugin: string,
  selections: readonly User.Selection[],
  signal: AbortSignal,
  confirmText: () => string,
) => {
  const first = selections[0]
  if (!first) throw new Error(`plugin "${plugin}" did not provide an authentication method`)
  const value = ref(first.id)
  const result = Promise.withResolvers<string>()
  const dialog = window.$dialog.create({
    closable: false,
    content: () =>
      h(NSelect, {
        'options': selections.map(selection => ({
          label: translateText(selection.name),
          value: selection.id,
        })),
        'value': value.value,
        'onUpdate:value': next => (value.value = next),
      }),
    maskClosable: false,
    onPositiveClick: () => result.resolve(value.value),
    positiveText: confirmText(),
    title: plugin,
  })
  try {
    return await raceAbort(result.promise, signal)
  } finally {
    dialog.destroy()
  }
}

const createAuthMethod = (plugin: string, signal: AbortSignal): User.Method => ({
  async form(form) {
    signal.throwIfAborted()
    const instance = createForm(localizeForm(form))
    const dialog = window.$dialog.create({
      closable: false,
      content: () => instance.comp,
      maskClosable: false,
      title: plugin,
    })
    try {
      return await raceAbort(instance.data, signal)
    } finally {
      dialog.destroy()
    }
  },
  async website<T>(url: string, injectCode: User.InjectCode) {
    signal.throwIfAborted()
    const page = new PageWebviewAuth<T>(url, injectCode, { title: plugin })
    try {
      return await raceAbort(page.mount(), signal)
    } finally {
      await page.unmount()
    }
  },
})

export const createPluginAuthGateway = (confirmText: () => string): PluginAuthGateway => ({
  async authenticate(plugin, auth, signal) {
    signal.throwIfAborted()
    const preferred = await raceAbort(auth.default(), signal)
    if (preferred === true) return
    const selectionId =
      typeof preferred === 'string'
        ? preferred
        : await chooseSelection(plugin, auth.selections, signal, confirmText)
    const selection = auth.selections.find(candidate => candidate.id === selectionId)
    if (!selection) {
      throw new Error(`plugin "${plugin}" selected an unknown authentication method`)
    }
    await raceAbort(selection.call(createAuthMethod(plugin, signal)), signal)
  },
})