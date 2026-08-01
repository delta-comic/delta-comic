import type { RemoteModel } from './remote'
export * as Remote from './remote'

import type { UserModel } from './user'
export * as User from './user'

import type { ExposeModel } from './expose'
export * as Expose from './expose'

import type { ContentModel } from './content'
export * as Content from './content'

import type { SocialModel } from './social'
export * as Social from './social'

import type { SpecialModel } from './special'
export * as Special from './special'

export interface PluginConfigModel {
  remotes?: RemoteModel
  user?: UserModel
  content?: ContentModel
  social?: SocialModel
  expose?: ExposeModel
  special?: SpecialModel
}