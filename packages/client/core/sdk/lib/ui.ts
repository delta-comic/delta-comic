import { environmentRegistry } from '@delta-comic/ui/environment'
import type { Component } from 'vue'

import type { ClientUi } from './host.js'

export const createClientUi = (owner: string): ClientUi => {
  const disposers = new Set<() => void>()
  const register = (disposer: () => void) => {
    disposers.add(disposer)
    return () => {
      if (!disposers.delete(disposer)) return
      disposer()
    }
  }

  return {
    registerRoute: () => register(() => undefined),
    registerNavItem: () => register(() => undefined),
    registerCommand: () => register(() => undefined),
    registerEnvironment: (key, component: Component, condition) =>
      register(environmentRegistry.register(key, component, condition, owner)),
    dispose: () => {
      environmentRegistry.removeOwner(owner)
      for (const disposer of disposers) disposer()
      disposers.clear()
    },
  }
}