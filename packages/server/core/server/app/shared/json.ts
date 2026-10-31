export const parseJson = <T>(value: string | null | undefined): T | undefined => {
  if (value === null || value === undefined) return undefined
  return JSON.parse(value) as T
}