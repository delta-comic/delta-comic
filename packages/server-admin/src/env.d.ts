/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
