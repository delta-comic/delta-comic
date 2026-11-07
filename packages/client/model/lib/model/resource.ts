import { logger } from '@delta-comic/logger'
import { isEmpty, isString } from 'es-toolkit/compat'
import { shallowReactive } from 'vue'

import { field, MetaStruct, SourcedKeyMap, transform, type Metadatable } from '../struct'

const resourceLogger = logger.scoped('model:resource')

export interface UniResourceProcessor {
  name: string
  call: (nowPath: string, resource: UniResource) => Promise<[path: string, exit: boolean]>
}
export interface UniResourceProcessStep {
  referenceName: string
  ignoreExit?: boolean
}
export type UniResourceProcessStep_ = UniResourceProcessStep | string
export interface UniResourceRaw extends Metadatable {
  pathname: string
  type: string
  processSteps?: UniResourceProcessStep_[]
}
export class UniResource extends MetaStruct<UniResourceRaw> implements UniResourceRaw {
  public static processInstances = SourcedKeyMap.createReactive<
    [plugin: string, referenceName: string],
    UniResourceProcessor
  >()

  public static fork = SourcedKeyMap.createReactive<[plugin: string, type: string], string[]>()

  public static precedenceFork = SourcedKeyMap.createReactive<
    [plugin: string, type: string],
    string
  >()
  public static is(value: unknown): value is UniResource {
    return value instanceof this
  }
  public static create(v: UniResourceRaw): UniResource {
    return new this(v)
  }
  @field type!: string
  @field pathname!: string
  @transform((v: UniResourceProcessStep_[] | undefined) =>
    (v ?? []).map<UniResourceProcessStep>(step =>
      isString(step) ? { referenceName: step, ignoreExit: false } : step,
    ),
  )
  processSteps!: UniResourceProcessStep[]
  public async getUrl(): Promise<string> {
    let resultPath = this.pathname
    for (const option of this.processSteps) {
      // preflight
      const instance = UniResource.processInstances.get([this.$$plugin, option.referenceName])
      if (!instance) {
        resourceLogger.warn('resource process not found', {
          plugin: this.$$plugin,
          referenceName: option.referenceName,
        })
        continue
      }

      // call
      const result = await instance.call(resultPath, this)
      resultPath = result[0]
      if (option.ignoreExit || !result[1]) continue
      break
    }
    if (!URL.canParse(resultPath)) return `${this.getThisFork()}/${resultPath}`
    return resultPath
  }
  public omittedForks = shallowReactive(new Set<string>())
  public getThisFork() {
    const all = new Set(UniResource.fork.get([this.$$plugin, this.type]) ?? [])
    let fork: string | undefined
    if (isEmpty(this.omittedForks)) {
      fork = UniResource.precedenceFork.get([this.$$plugin, this.type])
    } else {
      const diff = Array.from(all.difference(this.omittedForks).values())
      fork = diff[0]
    }
    if (!fork)
      throw new Error(
        `[UniResource.getThisFork] fork not found, type: [${this.$$plugin}, ${this.type}]`,
      )
    return fork
  }
  public localChangeFork() {
    const all = new Set(UniResource.fork.get([this.$$plugin, this.type]) ?? [])
    this.omittedForks.add(this.getThisFork())
    const isChangedFail = isEmpty(all.difference(this.omittedForks))
    if (isChangedFail) this.omittedForks.clear()
    return isChangedFail
  }
}