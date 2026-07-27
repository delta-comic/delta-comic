import { shallowReactive, type Component } from 'vue'

import type { Metadata, Metadatable } from '@/struct'

import { UniImage } from './image'
import type { UniResourceRaw } from './resource'

export interface UniUserRaw extends Metadatable {
  avatar?: UniResourceRaw
  name: string
  id: string
}

export abstract class UniUser {
  public static userBase = shallowReactive(new Map<string, UniUser>())
  public static userEditorBase = shallowReactive(new Map<string, Component>())
  public static userCards = shallowReactive(new Map<string, UniUserCardComponent>())

  constructor(v: UniUserRaw) {
    if (v.avatar) this.avatar = UniImage.create(v.avatar)
    this.name = v.name
    this.id = v.id
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
  }
  public avatar?: UniImage
  public name: string
  public id: string
  public $$plugin: string
  public $$meta?: Metadata
  public abstract customUser: object
}

export type UniUserCardComponent = Component<{ user: UniUser; isSmall?: boolean }>