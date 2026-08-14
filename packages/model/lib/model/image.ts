import type { Metadatable } from '../struct'

import { UniResource, type UniResourceRaw, type UniResourceProcessStep_ } from './resource'

export interface UniImageRaw extends Metadatable {
  path: string
  forkNamespace: string
  processSteps?: UniResourceProcessStep_[]
}

export class UniImage extends UniResource {
  public static override is(value: unknown): value is UniImage {
    return value instanceof this
  }
  public static override create(
    v: UniResourceRaw | UniImageRaw,
    aspect?: UniImageAspect,
  ): UniImage {
    return new this(v, aspect)
  }
  protected constructor(v: UniResourceRaw | UniImageRaw, aspect?: UniImageAspect) {
    if ('forkNamespace' in v)
      super({
        $$plugin: v.$$plugin,
        $$meta: { ...v.$$meta, aspect },
        pathname: v.path,
        type: v.forkNamespace,
        processSteps: v.processSteps,
      })
    else super(v)
  }
  public get aspect() {
    return this.$$meta!.aspect as Partial<UniImageAspect> | undefined
  }
  public set aspect(v) {
    if (!v) return
    this.$$meta ??= {}
    const aspect = (this.$$meta.aspect ??= {}) as Partial<UniImageAspect>
    aspect.width = v.width
    aspect.height = v.height
  }
}
export interface UniImageAspect {
  width: number
  height: number
}
export type UniImage_ = string | UniImage