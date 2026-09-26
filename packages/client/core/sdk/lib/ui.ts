import { environmentRegistry } from '@delta-comic/ui/environment'
import type { Component } from 'vue'

import type { ClientRouteRegistration, ClientUi, ClientUiRegistrars } from './host.js'

export const createClientUi = (owner: string, registrars: ClientUiRegistrars = {}): ClientUi => {
  const disposers = new Set<() => void>()
  const register = (disposer: () => void) => {
    disposers.add(disposer)
    return () => {
      if (!disposers.delete(disposer)) return
      disposer()
    }
  }

  return {
    registerRoute: (route: ClientRouteRegistration) =>
      register(registrars.route?.(route, owner) ?? (() => undefined)),
    registerNavItem: (item: ClientRouteRegistration) =>
      register(registrars.navItem?.(item, owner) ?? (() => undefined)),
    registerCommand: (id, handler) =>
      register(registrars.command?.(id, handler, owner) ?? (() => undefined)),
    registerEnvironment: (key, component: Component, condition) =>
      register(environmentRegistry.register(key, component, condition, owner)),
    dispose: () => {
      environmentRegistry.removeOwner(owner)
      for (const disposer of disposers) disposer()
      disposers.clear()
    },
  }
}