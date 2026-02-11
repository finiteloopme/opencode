/**
 * A2A Agent Registry
 *
 * Manages the list of available blockchain agents and their connection info.
 */

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
 * Registry of available A2A blockchain agents
 */
export const AGENTS: Record<string, AgentConfig> = {
  somnia: {
    id: "somnia",
    name: "Somnia Agent",
    description: "High-performance EVM L1 with 1M+ TPS. Generates and deploys Solidity contracts.",
    url: process.env.SOMNIA_AGENT_URL || "http://localhost:4001",
    chainId: 50312, // Testnet (Shannon) by default
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
    chainId: 146, // Sonic mainnet
    status: "pending",
    keywords: ["sonic", "ftm", "fantom"],
  },
  midnight: {
    id: "midnight",
    name: "Midnight Agent",
    description: "Privacy-preserving blockchain with zero-knowledge proofs.",
    url: process.env.MIDNIGHT_AGENT_URL || "http://localhost:4003",
    chainId: 0, // TBD
    status: "pending",
    keywords: ["midnight", "privacy", "zk", "zero knowledge", "confidential"],
  },
}

/**
 * Get all active agents
 */
export function getActiveAgents(): AgentConfig[] {
  return Object.values(AGENTS).filter((agent) => agent.status === "active")
}

/**
 * Get agent by ID
 */
export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS[id]
}

/**
 * Get all agents
 */
export function getAllAgents(): AgentConfig[] {
  return Object.values(AGENTS)
}

/**
 * Check if an agent is available (status is active)
 */
export function isAgentAvailable(id: string): boolean {
  const agent = AGENTS[id]
  return agent?.status === "active"
}
