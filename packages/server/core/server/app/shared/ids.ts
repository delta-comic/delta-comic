export const createId = (prefix: string): string => `${prefix}_${crypto.randomUUID()}`

export const isUuid = (value: string): boolean => {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
  return uuidPattern.test(value)
}