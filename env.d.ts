/// <reference types="vite/client" />

declare module 'userscript-meta' {
  function parse(userscript: string): any
  function stringify(meta: Meta): string
}
