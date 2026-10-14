/// <reference types="vite-plus/client" />
/// <reference types="@delta-comic/client-core-utils" />

declare module '*.css' {}

declare module '*.css?inline' {
  const content: string
  export default content
}

declare module 'tailwind-merge' {
  export type ClassNameValue = ClassNameArray | string | null | undefined | 0 | 0n | false
  export type ClassNameArray = readonly ClassNameValue[]
  export const twMerge: (...classLists: ClassNameValue[]) => string
}