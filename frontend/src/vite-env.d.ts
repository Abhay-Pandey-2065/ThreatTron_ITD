/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the FastAPI backend (set in `.env`). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
