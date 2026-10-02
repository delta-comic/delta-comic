import { environmentRegistry } from '@delta-comic/ui/environment'
import type { Component } from 'vue'

import type { ClientRouteRegistration, ClientUi, ClientUiRegistrars } from './host.js'

export const createClientUi = (owner: string, registrars: ClientUiRegistrars = {}): ClientUi => {
  const disposers = new Set<() => void>()
  const pluginDisposers = new Map<string, Set<() => void>>()
  let activePlugin: string | undefined
  const register = (disposer: () => void) => {
    disposers.add(disposer)
    const scopePlugin = activePlugin
    if (scopePlugin) {
      const scoped = pluginDisposers.get(scopePlugin) ?? new Set<() => void>()
      scoped.add(disposer)
      pluginDisposers.set(scopePlugin, scoped)
    }
    return () => {
      if (!disposers.delete(disposer)) return
      if (scopePlugin) pluginDisposers.get(scopePlugin)?.delete(disposer)
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
      pluginDisposers.clear()
    },
    __beginPluginScope: (pluginId: string) => {
      activePlugin = pluginId
    },
    __endPluginScope: () => {
      activePlugin = undefined
    },
    __disposePlugin: (pluginId: string) => {
      for (const disposer of pluginDisposers.get(pluginId) ?? []) {
        disposers.delete(disposer)
        disposer()
      }
      pluginDisposers.delete(pluginId)
    },
  }
}