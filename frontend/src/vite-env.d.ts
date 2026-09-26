/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the FastAPI backend (set in `.env`). */
  readonly VITE_API_URL?: string
  /** Base URL for the ML API (defaults to the deployed ML service). */
  readonly VITE_ML_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
