import type { ModuleFactory, Registration } from '@delta-comic/runtime/modules'

const pending = new WeakMap<HTMLScriptElement, (record: Registration) => void>()
declare global {
  interface Window {
    __deltaComicRegister: (record: Registration) => void
  }
}

export async function registerScript(name: string, bytes: Uint8Array): Promise<ModuleFactory> {
  window.__deltaComicRegister ??= record => {
    const script = document.currentScript
    const receive = script instanceof HTMLScriptElement && pending.get(script)
    if (!receive) throw new Error('unexpected plugin registration')
    receive(record)
  }
  const script = document.createElement('script')
  const url = URL.createObjectURL(
    new Blob([Uint8Array.from(bytes)], { type: 'application/javascript' }),
  )
  try {
    return await new Promise<ModuleFactory>((resolve, reject) => {
      let factory: ModuleFactory | undefined
      pending.set(script, record => {
        if (factory || record?.package !== name || typeof record?.factory !== 'function')
          reject(new Error(`invalid or duplicate registration: ${name}`))
        else factory = record.factory
      })
      script.onload = () =>
        factory ? resolve(factory) : reject(new Error(`missing registration: ${name}`))
      script.onerror = () => reject(new Error(`registration failed: ${name}`))
      script.src = url
      document.head.append(script)
    })
  } finally {
    pending.delete(script)
    script.remove()
    URL.revokeObjectURL(url)
  }
}