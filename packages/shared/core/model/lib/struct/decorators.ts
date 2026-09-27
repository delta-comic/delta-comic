import type { Struct } from './struct'

/**
 * 从`$$raw`复制同名字段，作为字段的构造期初始值
 *
 * 语义与手写`constructor`里的`this.x = v.x`等价：一次性复制，之后字段可自由赋值，
 * 且赋值不会影响`toJSON()`（序列化始终来自`$$raw`）
 */
export function field<This extends object, Value>(
  _value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
): (this: This) => Value {
  const key = String(context.name)
  return function (this: This) {
    return (this as Struct<object>).getRawField(key) as Value
  }
}

/**
 * 对`$$raw`的同名字段做一次转换后再作为字段初始值
 *
 * 例如`@transform((v: UniContentType_) => key.toJSON(v)) contentType!: UniContentType`
 */
export function transform<TRaw, T>(
  fn: (raw: TRaw) => T,
): <This extends object, Value>(
  value: undefined,
  context: ClassFieldDecoratorContext<This, Value>,
) => (this: This) => T {
  return <This extends object, Value>(
    _value: undefined,
    context: ClassFieldDecoratorContext<This, Value>,
  ) => {
    const key = String(context.name)
    return function (this: This) {
      return fn((this as Struct<object>).getRawField(key) as TRaw)
    }
  }
}