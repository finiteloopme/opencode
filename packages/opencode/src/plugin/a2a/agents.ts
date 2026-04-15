/**
 * A2A Agent Registry Client
 *
 * Fetches the list of available blockchain agents from the Agent Registry service.
 * Falls back to static configuration if the registry is unavailable.
 */

import { Log } from "../../util/log"

const log = Log.create({ service: "plugin.a2a.agents" })

export interface AgentConfig {
  id: string
  name: string
  description: string
  url: string
  chainId: number
  status: "active" | "inactive" | "pending"
  keywords: string[]
}

/**
 * Agent Registry API response
 */
interface AgentRegistryResponse {
  agents: Array<{
    id: string
    name: string
    description: string
    url: string
    chainId: number
    keywords: string[]
    enabled: boolean
  }>
  version: string
  updated?: string
}

// Registry URL from environment or default
const REGISTRY_URL = process.env.AGENT_REGISTRY_URL || "http://localhost:4000"

// Cache for agents with TTL
let agentCache: AgentConfig[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minute

/**
 * Static fallback agents (used when registry is unavailable)
 */
const FALLBACK_AGENTS: Record<string, AgentConfig> = {
  somnia: {
    id: "somnia",
    name: "Somnia Agent",
    description: "High-performance EVM L1 with 1M+ TPS. Generates and deploys Solidity contracts.",
    url: process.env.SOMNIA_AGENT_URL || "http://localhost:4001",
    chainId: 50312,
    status: "active",
    keywords: [
      "somnia",
      "somi",
      "stt",
      "solidity",
      "smart contract",
      "erc20",
      "erc721",
      "nft",
      "token",
      "deploy",
      "contract",
      "evm",
      "reactivity",
      "data streams",
    ],
  },
  sonic: {
    id: "sonic",
    name: "Sonic Agent",
    description: "High-performance EVM chain. Smart contract development.",
    url: process.env.SONIC_AGENT_URL || "http://localhost:4002",
    chainId: 146,
    status: "pending",
    keywords: ["sonic", "ftm", "fantom"],
  },
  midnight: {
    id: "midnight",
    name: "Midnight Agent",
    description: "Privacy-preserving blockchain with zero-knowledge proofs.",
    url: process.env.MIDNIGHT_AGENT_URL || "http://localhost:4003",
    chainId: 0,
    status: "pending",
    keywords: ["midnight", "privacy", "zk", "zero knowledge", "confidential"],
  },
  store: {
    id: "store",
    name: "Store Agent",
    description: "Mock stationery web store. Browse and purchase items with crypto payments via x402.",
    url: process.env.STORE_AGENT_URL || "http://localhost:4004",
    chainId: 0,
    status: "active",
    keywords: ["store", "shop", "buy", "purchase", "stationery", "notebook", "pen", "pencil", "eraser", "catalog", "browse", "order", "cart"],
  },
  payment: {
    id: "payment",
    name: "Payment Agent",
    description: "x402 payment facilitator. Handles USDC payments, verification, and settlement.",
    url: process.env.PAYMENT_AGENT_URL || "http://localhost:4005",
    chainId: 0,
    status: "active",
    keywords: ["pay", "payment", "settle", "x402", "usdc", "transfer", "facilitator", "checkout", "invoice"],
  },
}

/**
 * Fetch agents from the registry service
 */
async function fetchAgentsFromRegistry(): Promise<AgentConfig[]> {
  try {
    const response = await fetch(`${REGISTRY_URL}/agents`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}`)
    }

    const data: AgentRegistryResponse = await response.json()

    // Convert registry format to AgentConfig
    return data.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      url: agent.url,
      chainId: agent.chainId,
      keywords: agent.keywords,
      status: agent.enabled ? ("active" as const) : ("inactive" as const),
    }))
  } catch (error) {
    log.warn("failed to fetch from registry, using fallback", { error, registryUrl: REGISTRY_URL })
    throw error
  }
}

/**
 * Get all agents (from registry with cache, or fallback)
 */
export async function getAgentsAsync(): Promise<AgentConfig[]> {
  const now = Date.now()

  // Return cached if still valid
  if (agentCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return agentCache
  }

  try {
    agentCache = await fetchAgentsFromRegistry()
    cacheTimestamp = now
    log.info("fetched agents from registry", { count: agentCache.length })
    return agentCache
  } catch {
    // Use fallback
    return Object.values(FALLBACK_AGENTS)
  }
}

/**
 * Get all agents synchronously (from cache or fallback)
 * Use this when async is not possible
 */
export function getAllAgents(): AgentConfig[] {
  if (agentCache) {
    return agentCache
  }
  return Object.values(FALLBACK_AGENTS)
}

/**
 * Get all active agents
 */
export async function getActiveAgents(): Promise<AgentConfig[]> {
  const agents = await getAgentsAsync()
  return agents.filter((agent) => agent.status === "active")
}

/**
 * Get all active agents synchronously
 */
export function getActiveAgentsSync(): AgentConfig[] {
  return getAllAgents().filter((agent) => agent.status === "active")
}

/**
 * Get agent by ID
 */
export async function getAgent(id: string): Promise<AgentConfig | undefined> {
  const agents = await getAgentsAsync()
  return agents.find((agent) => agent.id === id)
}

/**
 * Get agent by ID synchronously
 */
export function getAgentSync(id: string): AgentConfig | undefined {
  return getAllAgents().find((agent) => agent.id === id)
}

/**
 * Check if an agent is available (status is active)
 */
export async function isAgentAvailable(id: string): Promise<boolean> {
  const agent = await getAgent(id)
  return agent?.status === "active"
}

/**
 * Refresh the agent cache
 */
export async function refreshAgentCache(): Promise<void> {
  agentCache = null
  cacheTimestamp = 0
  await getAgentsAsync()
}

/**
 * Initialize agents (call on plugin load)
 */
export async function initializeAgents(): Promise<void> {
  log.info("initializing agent registry", { registryUrl: REGISTRY_URL })
  try {
    await getAgentsAsync()
  } catch {
    log.warn("using fallback agents")
  }
}
