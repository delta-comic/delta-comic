type JsonScalar = string | number | boolean | null
type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue }

const inaccessible = (error: unknown) =>
  `[Thrown while serializing: ${error instanceof Error ? error.message : String(error)}]`

/** Converts arbitrary JS values into a deterministic, JSON-safe structure. */
export class LogSerializer {
  public serializeArguments(values: readonly unknown[]): string {
    return values
      .map(value => {
        if (typeof value === 'string') return value
        const serialized = this.serialize(value)
        return typeof serialized === 'string' ? serialized : JSON.stringify(serialized)
      })
      .join(' ')
  }

  public serialize(value: unknown): JsonValue {
    return this.visit(value, '$', new WeakMap<object, string>())
  }

  private visit(value: unknown, path: string, seen: WeakMap<object, string>): JsonValue {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') {
      if (Number.isNaN(value)) return '[NaN]'
      if (value === Number.POSITIVE_INFINITY) return '[Infinity]'
      if (value === Number.NEGATIVE_INFINITY) return '[-Infinity]'
      return value
    }
    if (typeof value === 'undefined') return '[undefined]'
    if (typeof value === 'bigint') return `${value}n`
    if (typeof value === 'symbol') return value.toString()
    if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`

    const object = value as object
    const previousPath = seen.get(object)
    if (previousPath) return `[Circular ${previousPath}]`
    seen.set(object, path)

    if (value instanceof Date)
      return Number.isNaN(value.getTime()) ? '[Invalid Date]' : value.toISOString()
    if (value instanceof RegExp) return value.toString()
    if (value instanceof Error) return this.serializeError(value, path, seen)
    if (Array.isArray(value))
      return value.map((item, index) => this.visit(item, `${path}[${index}]`, seen))
    if (value instanceof Map)
      return {
        $type: 'Map',
        entries: [...value.entries()].map(([key, item], index) => [
          this.visit(key, `${path}.entries[${index}][0]`, seen),
          this.visit(item, `${path}.entries[${index}][1]`, seen),
        ]),
      }
    if (value instanceof Set)
      return {
        $type: 'Set',
        values: [...value].map((item, index) => this.visit(item, `${path}.values[${index}]`, seen)),
      }

    return this.serializeObject(object, path, seen)
  }

  private serializeError(
    error: Error,
    path: string,
    seen: WeakMap<object, string>,
  ): { [key: string]: JsonValue } {
    const result: { [key: string]: JsonValue } = { name: error.name, message: error.message }
    if (error.stack) result.stack = error.stack
    if ('cause' in error && error.cause !== undefined)
      result.cause = this.visit(error.cause, `${path}.cause`, seen)
    Object.assign(result, this.serializeObject(error, path, seen))
    return result
  }

  private serializeObject(
    object: object,
    path: string,
    seen: WeakMap<object, string>,
  ): { [key: string]: JsonValue } {
    const result: { [key: string]: JsonValue } = {}
    let keys: string[]
    try {
      keys = Object.keys(object).sort()
    } catch (error) {
      return { $error: inaccessible(error) }
    }
    for (const key of keys) {
      try {
        result[key] = this.visit((object as Record<string, unknown>)[key], `${path}.${key}`, seen)
      } catch (error) {
        result[key] = inaccessible(error)
      }
    }
    return result
  }
}

export const logSerializer = new LogSerializer()

export const serializeLogArguments = (values: readonly unknown[]) =>
  logSerializer.serializeArguments(values)