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
}