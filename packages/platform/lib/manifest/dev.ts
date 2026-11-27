import { Type, type Static } from 'typebox'
import { Value } from 'typebox/value'

export const DEV_MANIFEST_PATH = '/manifest.json'
export const DEV_EVENTS_PATH = '/events'
export const revisionPath = (revision: string, path: string) => `/revisions/${revision}/${path}`
const eventSchema = Type.Object({
  session: Type.String({ minLength: 1 }),
  sequence: Type.Integer({ minimum: 1 }),
  id: Type.String({ minLength: 1 }),
  revision: Type.String({ pattern: '^[a-f0-9]{64}$' }),
})
export type DevRevision = Static<typeof eventSchema>
export const isDevRevision = (value: unknown): value is DevRevision =>
  Value.Check(eventSchema, value)