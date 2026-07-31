import type { RemoteModel } from './remote'
export * as Remote from './remote'

import type { AuthModel } from './auth'
export * as Auth from './auth'

import type { ExposeModel } from './expose'
export * as Expose from './expose'

import type { ContentModel } from './content'
export * as Content from './content'

export interface PluginConfigModel {
  remotes: RemoteModel
  auth: AuthModel
  expose: ExposeModel
  content: ContentModel
}