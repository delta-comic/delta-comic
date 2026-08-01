import type { RemoteModel } from './remote'
export * as Remote from './remote'
export type * from './remote'

import type { UserModel } from './user'
export * as User from './user'
export type * from './user'

import type { ExposeModel } from './expose'
export * as Expose from './expose'
export type * from './expose'

import type { ContentModel } from './content'
export * as Content from './content'
export type * from './content'

import type { SocialModel } from './social'
export * as Social from './social'
export type * from './social'

import type { SpecialModel } from './special'
export * as Special from './special'
export type * from './special'

import type { ResourceModel } from './resource'
export * as Resource from './resource'
export type * from './resource'

export interface PluginConfigModel {
  remotes?: RemoteModel
  resource?: ResourceModel
  user?: UserModel
  content?: ContentModel
  social?: SocialModel
  expose?: ExposeModel
  special?: SpecialModel
}