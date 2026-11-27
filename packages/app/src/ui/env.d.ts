declare module 'tailwind-merge' {
  export type ClassNameValue = ClassNameArray | string | null | undefined | 0 | 0n | false
  export type ClassNameArray = readonly ClassNameValue[]
  export const twMerge: (...classLists: ClassNameValue[]) => string
}