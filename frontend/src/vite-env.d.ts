/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_backend: string
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
