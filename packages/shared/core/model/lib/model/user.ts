import { shallowReactive, type Component } from 'vue'

import { field, MetaStruct, transform, type Metadatable } from '../struct'

import { UniImage } from './image'
import type { UniResourceRaw } from './resource'

export interface UniUserRaw extends Metadatable {
  avatar?: UniResourceRaw
  name: string
  id: string
}

export abstract class UniUser extends MetaStruct<UniUserRaw> {
  public static userBase = shallowReactive(new Map<string, UniUser>())
  public static userEditorBase = shallowReactive(new Map<string, Component>())
  public static userCards = shallowReactive(new Map<string, UniUserCardComponent>())

  @transform((v: UniResourceRaw | undefined) => v && UniImage.create(v))
  avatar?: UniImage
  @field name!: string
  @field id!: string
  public abstract customUser: object
}

export type UniUserCardComponent = Component<{ user: UniUser; isSmall?: boolean }>