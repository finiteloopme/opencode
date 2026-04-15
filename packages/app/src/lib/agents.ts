/**
 * Agent Registry API Client
 *
 * Provides functions to fetch available blockchain agents and their health status.
 * Used by the AgentPicker component for lazy health checking.
 *
 * The frontend proxies requests through the OpenCode backend (/global/registry/*)
 * which forwards them to the Agent Registry service. This avoids CORS issues
 * and allows the registry URL to be configured at runtime on the server.
 */

/**
 * Agent info from the registry
 */
export interface AgentInfo {
  id: string
  name: string
  description: string
  url: string
  chainId: number
  keywords: string[]
  enabled: boolean
}

/**
 * Agent health status
 */
export interface AgentHealthStatus {
  id: string
  name: string
  url: string
  healthy: boolean
  latencyMs: number | null
  error?: string
}

/**
 * Registry response for /agents
 */
export interface AgentRegistryResponse {
  agents: AgentInfo[]
  version: string
  updated?: string
}

/**
 * Registry response for /agents/health
 */
export interface AgentHealthResponse {
  agents: AgentHealthStatus[]
  checkedAt: string
}

/**
 * Fetch all enabled agents from the registry (via backend proxy)
 *
 * @param serverUrl - Base URL of the OpenCode server
 */
export async function fetchAgents(serverUrl: string): Promise<AgentInfo[]> {
  const url = `${serverUrl}/global/registry/agents`

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.status} ${response.statusText}`)
  }

  const data: AgentRegistryResponse = await response.json()
  return data.agents
}

/**
 * Fetch health status for all enabled agents (via backend proxy)
 *
 * This is called lazily when the agent picker is opened.
 *
 * @param serverUrl - Base URL of the OpenCode server
 */
export async function fetchAgentHealth(serverUrl: string): Promise<AgentHealthStatus[]> {
  const url = `${serverUrl}/global/registry/agents/health`

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch agent health: ${response.status} ${response.statusText}`)
  }

  const data: AgentHealthResponse = await response.json()
  return data.agents
}
