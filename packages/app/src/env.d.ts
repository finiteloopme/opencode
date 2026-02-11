interface ImportMetaEnv {
  readonly VITE_OPENCODE_SERVER_HOST: string
  readonly VITE_OPENCODE_SERVER_PORT: string
  readonly VITE_APP_ENV: "dev" | "test" | "production"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Config injected by Vite from config.toml
declare const __CONFIG__: import("./lib/config").TomlConfig
