import { shallowReactive } from 'vue'

import type { PluginBooter, PluginInstaller, PluginLoader } from './extensionTypes'

interface NamedExtension {
  name: string
}

interface ExtensionEntry<T extends NamedExtension> {
  extension: T
  order: number
  owner?: string
  sequence: number
}

export interface RuntimeExtensionOptions {
  order?: number
}

class OrderedExtensionRegistry<T extends NamedExtension> {
  public readonly values = shallowReactive(new Array<T>())
  private readonly entries: ExtensionEntry<T>[] = []
  private sequence = 0

  public constructor(private readonly direction: 'ascending' | 'descending') {}

  public register(extension: T, options: RuntimeExtensionOptions = {}, owner?: string) {
    const entry: ExtensionEntry<T> = {
      extension,
      order: options.order ?? 0,
      owner,
      sequence: this.sequence++,
    }
    this.entries.push(entry)
    this.refresh()
    return () => {
      const index = this.entries.indexOf(entry)
      if (index < 0) return
      this.entries.splice(index, 1)
      this.refresh()
    }
  }

  public removeOwner(owner: string) {
    let changed = false
    for (let index = this.entries.length - 1; index >= 0; index--) {
      if (this.entries[index].owner !== owner) continue
      this.entries.splice(index, 1)
      changed = true
    }
    if (changed) this.refresh()
  }

  private refresh() {
    const activeByName = new Map<string, ExtensionEntry<T>>()
    for (const entry of this.entries) activeByName.set(entry.extension.name, entry)
    const direction = this.direction === 'ascending' ? 1 : -1
    const active = [...activeByName.values()]
      .sort(
        (left, right) => (left.order - right.order) * direction || left.sequence - right.sequence,
      )
      .map(entry => entry.extension)
    this.values.splice(0, this.values.length, ...active)
  }
}

export class PluginRuntimeExtensions {
  public readonly booters = new OrderedExtensionRegistry<PluginBooter>('ascending')
  public readonly installers = new OrderedExtensionRegistry<PluginInstaller>('descending')
  public readonly loaders = new OrderedExtensionRegistry<PluginLoader>('ascending')
  private readonly owners: string[] = []

  public registerBooter(booter: PluginBooter, options?: RuntimeExtensionOptions) {
    return this.booters.register(booter, options, this.owners.at(-1))
  }

  public registerInstaller(installer: PluginInstaller, options?: RuntimeExtensionOptions) {
    return this.installers.register(installer, options, this.owners.at(-1))
  }

  public registerLoader(loader: PluginLoader, options?: RuntimeExtensionOptions) {
    return this.loaders.register(loader, options, this.owners.at(-1))
  }

  public removeOwner(owner: string) {
    this.booters.removeOwner(owner)
    this.installers.removeOwner(owner)
    this.loaders.removeOwner(owner)
  }

  public async withOwner<T>(owner: string, action: () => Promise<T>): Promise<T> {
    this.owners.push(owner)
    try {
      return await action()
    } finally {
      this.owners.pop()
    }
  }
}

export const runtimeExtensions = new PluginRuntimeExtensions()

export const registerBooter = runtimeExtensions.registerBooter.bind(runtimeExtensions)
export const registerInstaller = runtimeExtensions.registerInstaller.bind(runtimeExtensions)
export const registerLoader = runtimeExtensions.registerLoader.bind(runtimeExtensions)