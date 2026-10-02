import type { ContentHooks } from './content'
export * from './content'

import type { RemoteHooks } from './remote'
export * from './remote'

import type { SocialHooks } from './social'
export * from './social'

import type { LifecycleHooks } from './lifecycle'
export * from './lifecycle'

export type PluginConfigHooks = Partial<RemoteHooks & ContentHooks & SocialHooks & LifecycleHooks>