import { useGlobalVar } from '@delta-comic/utils'
import { isEmpty, isString } from 'es-toolkit/compat'
import { shallowReactive } from 'vue'

import { SourcedKeyMap, Struct, type MetaData } from '../struct'

export type ProcessInstance = (
  nowPath: string,
  resource: Resource
) => Promise<[path: string, exit: boolean]>
export interface ProcessStep {
  referenceName: string
  ignoreExit?: boolean
}
export type ProcessStep_ = ProcessStep | string

export interface ResourceType {
  type: string
  urls: string[]
  test: (url: string, signal: AbortSignal) => PromiseLike<void>
}
export interface RawResource {
  $$plugin: string
  $$meta?: MetaData
  pathname: string
  type: string
  processSteps?: ProcessStep_[]
}
export class Resource extends Struct<RawResource> implements RawResource {
  public static processInstances = useGlobalVar(
    SourcedKeyMap.create<[plugin: string, referenceName: string], ProcessInstance>(),
    'uni/resource/processInstances'
  )

  public static fork = useGlobalVar(
    SourcedKeyMap.create<[plugin: string, type: string], ResourceType>(),
    'uni/resource/fork'
  )
  public static precedenceFork = useGlobalVar(
    SourcedKeyMap.create<[plugin: string, type: string], string>(),
    'uni/resource/precedenceFork'
  )

  public static is(value: unknown): value is Resource {
    return value instanceof this
  }
  public static create(v: RawResource): Resource {
    return new this(v)
  }
  protected constructor(v: RawResource) {
    super(v)
    this.$$plugin = v.$$plugin
    this.$$meta = v.$$meta
    this.pathname = v.pathname
    this.type = v.type
    this.processSteps = (v.processSteps ?? []).map<ProcessStep>(v =>
      isString(v) ? { referenceName: v, ignoreExit: false } : v
    )
  }
  public type: string
  public pathname: string
  public processSteps: ProcessStep[]
  public $$meta?: MetaData
  public $$plugin: string
  public async getUrl(): Promise<string> {
    let resultPath = this.pathname
    for (const option of this.processSteps) {
      // preflight
      const instance = Resource.processInstances.get([this.$$plugin, option.referenceName])
      if (!instance) {
        console.warn(
          `[Resource.getUrl] process not found, fullname: [${this.$$plugin}, ${option.referenceName}]`
        )
        continue
      }

      // call
      const result = await instance(resultPath, this)
      resultPath = result[0]
      if (option.ignoreExit || !result[1]) continue
      break
    }
    if (!URL.canParse(resultPath)) return `${this.getThisFork()}/${resultPath}`
    return resultPath
  }
  public omittedForks = shallowReactive(new Set<string>())
  public getThisFork() {
    const all = new Set(Resource.fork.get([this.$$plugin, this.type])?.urls ?? [])
    let fork: string | undefined
    if (isEmpty(this.omittedForks)) {
      fork = Resource.precedenceFork.get([this.$$plugin, this.type])
    } else {
      const diff = Array.from(all.difference(this.omittedForks).values())
      fork = diff[0]
    }
    if (!fork)
      throw new Error(
        `[Resource.getThisFork] fork not found, type: [${this.$$plugin}, ${this.type}]`
      )
    return fork
  }
  public localChangeFork() {
    const all = new Set(Resource.fork.get([this.$$plugin, this.type])?.urls ?? [])
    this.omittedForks.add(this.getThisFork())
    const isChangedFail = isEmpty(all.difference(this.omittedForks))
    if (isChangedFail) this.omittedForks.clear()
    return isChangedFail
  }
}