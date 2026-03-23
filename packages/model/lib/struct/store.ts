import { isString } from 'es-toolkit'
import { shallowReactive } from 'vue'

/**
 * 比如有很多需要注明来自哪个插件的值都可以用
 */
export class SourcedValue<T extends [string, string]> {
  public toJSON(value: T | string) {
    if (isString(value)) return this.parse(value)
    return value
  }
  public parse(value: string) {
    const splited = value.split(this.separator)
    return <T>[splited[0], splited.slice(1).join(this.separator)]
  }
  public toString(value: T | string) {
    if (isString(value)) return value
    return this.stringify(value)
  }
  public stringify(value: T) {
    return value.join(this.separator)
  }
  constructor(public separator = ':') {}
}
/**
 * 相比较于普通的Map，这个元素的key操作可以是`TKey | string`
 * _但内部保存仍使用`SourcedValue.key.toString`作为key_
 */
export class SourcedKeyMap<TKey extends [string, string], TValue> implements Map<string, TValue> {
  public static createReactive<TKey extends [string, string], TValue>(separator = ':') {
    return shallowReactive(new this<TKey, TValue>(separator))
  }
  public constructor(separator = ':') {
    this.key = new SourcedValue<TKey>(separator)
  }
  public key: SourcedValue<TKey>
  private store = shallowReactive(new Map<string, TValue>())
  public get size(): number {
    return this.store.size
  }
  public [Symbol.toStringTag] = 'SourcedKeyMap'
  public clear(): void {
    this.store.clear()
  }
  public delete(key: string | TKey): boolean {
    return this.store.delete(this.key.toString(key))
  }
  public forEach(
    callbackfn: (value: TValue, key: string, map: Map<string, TValue>) => void,
    thisArg?: any
  ): void {
    this.store.forEach((v, k) => {
      callbackfn.call(thisArg, v, k, this)
    })
  }
  public get(key: string | TKey): TValue | undefined {
    return this.store.get(this.key.toString(key))
  }
  public has(key: string | TKey): boolean {
    return this.store.has(this.key.toString(key))
  }
  public set(key: string | TKey, value: TValue): this {
    this.store.set(this.key.toString(key), value)
    return this
  }
  public entries() {
    return this.store.entries()
  }
  public keys() {
    return this.store.keys()
  }
  public values() {
    return this.store.values()
  }
  public [Symbol.iterator]() {
    return this.entries()
  }
}

export type SourcedKeyType<
  T extends SourcedKeyMap<[string, string], any> | SourcedValue<[string, string]>
> = T extends SourcedKeyMap<infer K, any> ? K : T extends SourcedValue<infer K> ? K : never