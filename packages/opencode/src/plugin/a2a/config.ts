/**
 * A2A Plugin Configuration
 *
 * Reads A2A configuration from environment variables.
 * Default agents can be configured via A2A_DEFAULT_AGENTS env var
 * (comma-separated list of agent IDs).
 *
 * Example: A2A_DEFAULT_AGENTS=somnia,sonic,midnight
 */

import { Log } from "../../util/log"

const log = Log.create({ service: "plugin.a2a.config" })

/**
 * A2A configuration
 */
export interface A2AConfig {
  /** Default agent IDs when no selection is provided */
  defaultAgents: string[]
}

// Cached config
let configCache: A2AConfig | null = null

/**
 * Parse default agents from environment variable
 */
function parseDefaultAgents(): string[] {
  const envValue = process.env.A2A_DEFAULT_AGENTS

  if (!envValue) {
    // Fallback: all known agents
    return ["somnia", "sonic", "midnight"]
  }

  const agents = envValue
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  log.info("parsed default agents from env", { agents })
  return agents
}

/**
 * Get A2A configuration
 */
export function getA2AConfig(): A2AConfig {
  if (configCache) {
    return configCache
  }

  configCache = {
    defaultAgents: parseDefaultAgents(),
  }

  log.info("initialized A2A config", { defaultAgents: configCache.defaultAgents })
  return configCache
}

/**
 * Get default agent IDs
 */
export function getDefaultAgentIds(): string[] {
  return getA2AConfig().defaultAgents
}

/**
 * Reset config cache (for testing)
 */
export function resetConfigCache(): void {
  configCache = null
}
