// oxlint-disable typescript/no-this-alias
import { SmartAbortController } from '@delta-comic/request'
import { useGlobalVar } from '@delta-comic/utils'
import { until } from '@vueuse/core'
import { markRaw, shallowRef, type Raw, ref, type Ref, computed } from 'vue'

type RawGenerator<T> = (
  this: Stream<T>,
  abortSignal: AbortSignal,
  /** @deprecated 使用`this`代替 */
  that: Stream<T>
) => IterableIterator<T[], void, Stream<T>> | AsyncIterableIterator<T[], void, Stream<T>>
const generatorMap = new Map<Stream<any>, RawGenerator<any>>()

/**
 * 可迭代数据流
 */
export type RStream<T> = Raw<Stream<T>>
/**
 * 可迭代数据流
 */
export class Stream<T> implements AsyncIterableIterator<T[], void> {
  /**
   * 使用`Stream.create`代替`new Stream`
   */
  private constructor(rawGenerator: RawGenerator<T>) {
    this.generator = rawGenerator.bind(this)(this.abortController.signal, this)
    generatorMap.set(this, rawGenerator)
    // console.trace('stream new', this)
  }
  private static _this
  static {
    this._this = useGlobalVar(this, 'data/Stream')
  }
  public static isStream(stream: any): stream is Stream<any> {
    return stream instanceof this._this
  }
  public static create<T>(generator: RawGenerator<T>): RStream<T> {
    const stream = new this._this<T>(generator)
    return markRaw(stream)
  }
  [x: symbol]: any
  private abortController = new SmartAbortController()
  private generator
  private _setupData = new Array<T>()
  /** 初始存在的数据(置顶) */
  public setupData(data: T[]) {
    this._setupData.push(...data)
    this.data.value.unshift(...data)
    return this
  }
  public async next(igRequesting = false): Promise<IteratorResult<T[], void>> {
    try {
      if (!igRequesting) {
        await until(this.isRequesting).toBe(false)
        this.isRequesting.value = true
      }
      if (this._isDone) {
        if (!igRequesting) this.isRequesting.value = false
        return { done: true, value: undefined }
      }
      if (igRequesting) console.log('igRequesting next')
      const { value, done } = await this.generator.next(this)
      this.isDone.value = done ?? false
      if (!igRequesting) this.isRequesting.value = false
      if (done) return { done: true, value: undefined }
      this.data.value.push(...value)
      return { value, done }
    } catch (error) {
      if (!igRequesting) this.isRequesting.value = false
      this.error.value = error as Error
      throw error
    }
  }
  public async return(): Promise<IteratorResult<T[], void>> {
    return (await this.generator.return?.()) ?? { value: undefined, done: true }
  }
  public async throw(e?: any): Promise<IteratorResult<T[], void>> {
    return (await this.generator.throw?.(e)) ?? { value: undefined, done: true }
  }
  public toReadableStream() {
    const that = this
    return new ReadableStream<T[]>({
      async pull(controller) {
        const { value, done } = await that.next()
        if (done) controller.close()
        else controller.enqueue(value)
      }
    })
  }
  /** 重置 */
  public reset() {
    const rawGenerator = generatorMap.get(this)!
    this.generator = rawGenerator.bind(this)(this.abortController.signal, this)
    this.total.value = NaN
    this.page.value = 0
    this.pageSize.value = NaN
    this.data.value = this._setupData
    this.isDone.value = false
    this.isRequesting.value = false
    this.error.value = undefined
  }
  /** 重试 */
  public async retry() {
    this.page.value--
    return this.next()
  }

  /** 一次性全部加载 */
  public async nextToDone() {
    if (isNaN(this._pages)) await this.next(true)
    const promises = []
    // e.g. p:1 ps:20 2->20
    for (let index = this._page + 1; index <= this._pages; index++) promises.push(this.next(true))
    await Promise.all(promises)
    return this._data
  }

  /** 停止正在进行的请求 */
  public stop() {
    this.abortController.abort()
    this.isRequesting.value = false
  }
  public [Symbol.asyncIterator]() {
    return this
  }

  /** 错误(如果有) */
  public error = shallowRef<void | Error>()

  /** 数据 */
  public data = ref<T[]>([]) as Ref<T[]>
  /** 数据 */
  public get _data() {
    return this.data.value
  }
  /** 当前页 */
  public page = shallowRef(0)
  /** 当前页 */
  public get _page() {
    return this.page.value
  }
  /** 总页数 */
  public pages = shallowRef(NaN)
  /** 总页数 */
  public get _pages() {
    return this.pages.value
  }
  /** 总条目数 */
  public total = shallowRef(NaN)
  /** 总条目数 */
  public get _total() {
    return this.total.value
  }
  /** 单页条目数 */
  public pageSize = shallowRef(NaN)
  /** 单页条目数 */
  public get _pageSize() {
    return this.pageSize.value
  }
  /** 数据当前总数 */
  public length = computed(() => this.data.value.length)
  /** 数据当前总数 */
  public get _length() {
    return this.data.value.length
  }
  /** 是否正在网络请求 */
  public isRequesting = shallowRef(false)
  /** 是否正在网络请求 */
  public get _isRequesting() {
    return this.isRequesting.value
  }
  /** 是否全部获取完成 */
  public isDone = shallowRef(false)
  /** 是否全部获取完成 */
  public get _isDone() {
    return this.isDone.value
  }
  /** 是否无结果 */
  public isNoData = computed(() => this.isDone.value && this.isEmpty.value)
  /** 是否无结果 */
  public get _isNoData() {
    return this.isNoData.value
  }
  /** 是否当前为空 */
  public isEmpty = computed(() => this.length.value === 0)
  /** 是否当前为空 */
  public get _isEmpty() {
    return this.isEmpty.value
  }
}
export const callbackToPromise = <T = void>(
  fn: (resolve: (result: T | PromiseLike<T>) => void) => any
) => {
  const { resolve, promise } = Promise.withResolvers<T>()
  fn(resolve)
  return promise
}