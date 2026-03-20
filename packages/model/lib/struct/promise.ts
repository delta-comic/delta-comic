import { useGlobalVar } from '@delta-comic/utils'
import { isError } from 'es-toolkit'
import { isEmpty } from 'es-toolkit/compat'
import mitt from 'mitt'
import { markRaw, shallowRef, type Raw } from 'vue'

type PromiseContentEmits<TR> = { success: TR; error: any; finial: void }
/**
 * 扩展内容的`Promise`，可视为普通`Promise`使用
 */
export class PromiseContent<
  T,
  TPF extends any = T,
  TEmits extends PromiseContentEmits<TPF> = PromiseContentEmits<TPF>
> implements PromiseLike<T> {
  [Symbol.toStringTag] = 'PromiseContent'
  private static _this
  static {
    this._this = useGlobalVar(this, 'data/PromiseContent')
  }
  public static isPromiseContent(value: unknown): value is PromiseContent<any> {
    return value instanceof this._this
  }
  public static fromPromise<T, TP = T>(
    promise: Promise<T>,
    processor: (val: T) => TP = v => <any>v
  ): RPromiseContent<T, TP> {
    const v = new this._this<T, TP>(promise, processor)
    return markRaw(v)
  }
  /**
   * 使用`PromiseContent.fromPromise`或`PromiseContent.fromAsyncFunction`代替`new PromiseContent`
   */
  private constructor(
    private promise: Promise<T>,
    private processor: (v: T) => TPF = v => <any>v
  ) {
    void this.loadPromise(promise)
  }
  public async loadPromise(promise: Promise<T>) {
    this.data.value = undefined
    this.isLoading.value = true
    this.isError.value = false
    this.errorCause.value = undefined
    this.isEmpty.value = true
    try {
      const v = await promise
      this.data.value = this.processor(v)
      this.isLoading.value = false
      this.isError.value = false
      this.isEmpty.value = isEmpty(v)
      this.emitter.emit('success', this.data.value)
    } catch (err) {
      this.data.value = undefined
      this.isError.value = true
      this.errorCause.value = isError(err) ? err : new Error(String(err))
      console.error('Non-throw Error [PromiseContent]', err)
      this.emitter.emit('error', err)
    }
    this.emitter.emit('finial', undefined)
  }
  private emitter = mitt<TEmits>()

  public onError(processor: (err: TEmits['error']) => any) {
    this.emitter.on('error', processor)
    return () => this.emitter.off('error', processor)
  }
  public onSuccess(processor: (err: TEmits['success']) => any) {
    this.emitter.on('success', processor)
    return () => this.emitter.off('success', processor)
  }
  public onFinal(processor: (err: TEmits['finial']) => any) {
    this.emitter.on('finial', processor)
    return () => this.emitter.off('finial', processor)
  }

  /**
   * 对`this.data.value`做出处理，多次调用仅最后一次生效
   */
  public setProcessor<TP>(processor: (val: T) => TP): RPromiseContent<T, TP> {
    return PromiseContent.fromPromise(this.promise, processor)
  }
  public catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<T | TResult> {
    return this.promise.catch<TResult>(onrejected)
  }
  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then<TResult1, TResult2>(onfulfilled, onrejected)
  }
  public finally(onfinally?: (() => void) | null): Promise<T> {
    return this.promise.finally(onfinally)
  }
  public data = shallowRef<TPF>()
  public isLoading = shallowRef(true)
  public isError = shallowRef(false)
  public errorCause = shallowRef<Error>()
  public isEmpty = shallowRef(true)
  public static fromAsyncFunction<T extends (...args: any[]) => Promise<any>>(asyncFunction: T) {
    return (...args: Parameters<T>): RPromiseContent<Awaited<ReturnType<T>>> =>
      this.fromPromise((() => asyncFunction(...args))())
  }
  public static resolve<T>(data: T) {
    const pc = this.fromPromise(Promise.resolve(data))
    pc.isLoading.value = false
    return pc
  }
  public static withResolvers<T>(isLoading = false): PromiseWithResolvers<T> {
    let withResolvers = Promise.withResolvers<T>()
    const content = new this._this<T>(withResolvers.promise)
    content.isLoading.value = isLoading
    return {
      content,
      reject: (reason?: any) => {
        withResolvers.reject(reason)
      },
      resolve: (value: T | PromiseLike<T>) => {
        withResolvers.resolve(value)
      },
      reset(isLoading = false) {
        withResolvers = Promise.withResolvers<T>()
        void content.loadPromise(withResolvers.promise)
        content.isLoading.value = isLoading
      }
    }
  }
}
export type PromiseWithResolvers<T> = {
  content: RPromiseContent<T>
  reject: (reason?: any) => void
  resolve: (value: T | PromiseLike<T>) => void
  reset: (isLoading?: boolean) => void
}
export type RPromiseContent<T, PTF = T> = Raw<PromiseContent<T, PTF>>