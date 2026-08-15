import type { Static, TProperties, TSchema } from 'typebox'
import { IsOptional, IsUnion, Type } from 'typebox'
import { describe, expect, expectTypeOf, it } from 'vitest'

const optionalInt = Type.Optional(Type.Integer())
const requiredInt = Type.Integer()
const stringUnion = Type.Union([Type.Literal('a'), Type.Literal('b')])

describe('typebox 1.x API', () => {
  it('exports TSchema, Static and TProperties types', () => {
    const props: TProperties = { a: Type.String() }
    const schema: TSchema = Type.String()
    expect(Object.keys(props)).toEqual(['a'])
    expect(schema.type).toBe('string')
  })

  it('Static of Optional includes undefined', () => {
    expectTypeOf<Static<typeof optionalInt>>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Static<typeof requiredInt>>().toEqualTypeOf<number>()
  })

  it('IsOptional distinguishes optional schemas', () => {
    expect(IsOptional(Type.String())).toBe(false)
    expect(IsOptional(optionalInt)).toBe(true)
  })

  it('IsUnion detects unions', () => {
    expect(IsUnion(Type.String())).toBe(false)
    expect(IsUnion(stringUnion)).toBe(true)
  })
})