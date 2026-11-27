import { shallowReactive, type Component } from 'vue'

import { UniImage } from './image'
import type { UniResourceRaw } from './resource'
import { MetaStruct, type Metadatable } from './struct'

export interface UniUserRaw extends Metadatable {
  avatar?: UniResourceRaw
  name: string
  id: string
}

export abstract class UniUser extends MetaStruct<UniUserRaw> {
  public static userBase = shallowReactive(new Map<string, UniUser>())
  public static userEditorBase = shallowReactive(new Map<string, Component>())
  public static userCards = shallowReactive(new Map<string, UniUserCardComponent>())

  avatar = this.$$raw.avatar && UniImage.create(this.$$raw.avatar)
  name = this.$$raw.name
  id = this.$$raw.id
  public abstract customUser: object
}

export type UniUserCardComponent = Component<{ user: UniUser; isSmall?: boolean }>