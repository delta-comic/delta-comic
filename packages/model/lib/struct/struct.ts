/**
 * 可以结构化的数据，调用`toJSON`获取纯粹的json(没有get/set或method)
 */
export class Struct<TRaw extends object> {
  public toJSON(): TRaw {
    return JSON.parse(JSON.stringify(this.$$raw))
  }
  /**
   * @param $$raw 一个纯粹json对象，不可以是高级对象
   */
  constructor(protected $$raw: TRaw) {}
  /**
   * 仅供`@field`/`@transform`初始化器读取原始字段，外部不应依赖
   * @internal
   */
  public getRawField(key: string): unknown {
    return (this.$$raw as Record<string, unknown>)[key]
  }
  public static toRaw<T extends object, TRaw = T extends Struct<infer TR> ? TR : T>(item: T): TRaw {
    if (item instanceof Struct) return item.toJSON()
    return item as any
  }
}