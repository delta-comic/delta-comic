import { shallowReactive, type Component } from 'vue'

import type { Metadata, Metadatable } from '@/struct'

import { Image } from './image'
import type { RawResource } from './resource'

export interface RawUser extends Metadatable {
  avatar?: RawResource
  name: string
  id: string
}

export abstract class User {
  public static userBase = shallowReactive(new Map<string, User>())
  public static userEditorBase = shallowReactive(new Map<string, Component>())
  public static userCards = shallowReactive(new Map<string, UserCardComponent>())

  constructor(v: RawUser) {
    if (v.avatar) this.avatar = Image.create(v.avatar)
    this.name = v.name
    this.id = v.id
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
  }
  public avatar?: Image
  public name: string
  public id: string
  public $$plugin: string
  public $$meta?: Metadata
  public abstract customUser: object
}

export type UserCardComponent = Component<{ user: User; isSmall?: boolean }>