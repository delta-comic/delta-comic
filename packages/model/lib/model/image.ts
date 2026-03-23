import type { Metadatable } from '../struct'

import { Resource, type RawResource, type ProcessStep_ } from './resource'

export interface RawImage extends Metadatable {
  path: string
  forkNamespace: string
  processSteps?: ProcessStep_[]
}

export class Image extends Resource {
  public static override is(value: unknown): value is Image {
    return value instanceof this
  }
  public static override create(v: RawResource | RawImage, aspect?: ImageAspect): Image {
    return new this(v, aspect)
  }
  protected constructor(v: RawResource | RawImage, aspect?: ImageAspect) {
    if ('forkNamespace' in v)
      super({
        $$plugin: v.$$plugin,
        $$meta: { ...v.$$meta, aspect },
        pathname: v.path,
        type: v.forkNamespace,
        processSteps: v.processSteps
      })
    else super(v)
  }
  public get aspect() {
    return this.$$meta!.aspect as Partial<ImageAspect> | undefined
  }
  public set aspect(v) {
    if (!v) return
    this.$$meta ??= {}
    this.$$meta.aspect ??= {}
    this.$$meta.aspect.width = v.width
    this.$$meta.aspect.height = v.height
  }
}
export interface ImageAspect {
  width: number
  height: number
}
export type Image_ = string | Image