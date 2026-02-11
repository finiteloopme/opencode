/**
 * Frontend configuration loader
 *
 * Config resolution order (later overrides earlier):
 * 1. config.toml [default] section
 * 2. config.toml [env] section (dev/test/production)
 * 3. VITE_* environment variables (CLI override)
 */

// Type for the TOML config structure
interface ServerConfig {
  host: string
  port: number
}

interface EnvConfig {
  server: ServerConfig
}

interface TomlConfig {
  default: EnvConfig
  dev?: Partial<EnvConfig>
  test?: Partial<EnvConfig>
  production?: Partial<EnvConfig>
}

// Injected by Vite from config.toml
declare const __CONFIG__: TomlConfig

// Get current environment (default: "dev")
type AppEnv = "dev" | "test" | "production"
const appEnv = (import.meta.env.VITE_APP_ENV ?? "dev") as AppEnv

// Merge default with environment-specific config
function getEnvConfig(): EnvConfig {
  const envConfig = __CONFIG__[appEnv] ?? {}
  return {
    server: {
      ...__CONFIG__.default.server,
      ...envConfig.server,
    },
  }
}

// Final config with env var overrides (C overrides B)
const envConfig = getEnvConfig()

export const config = {
  server: {
    host: import.meta.env.VITE_OPENCODE_SERVER_HOST ?? envConfig.server.host,
    port: Number(import.meta.env.VITE_OPENCODE_SERVER_PORT ?? envConfig.server.port),
  },
  env: appEnv,
}

export function getServerUrl(): string {
  return `http://${config.server.host}:${config.server.port}`
}

export type { TomlConfig, EnvConfig, ServerConfig, AppEnv }
