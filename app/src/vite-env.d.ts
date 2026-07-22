/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Android build ke liye — https://hisaabi.vercel.app jaisa poora URL */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
