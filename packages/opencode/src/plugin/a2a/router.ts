/**
 * A2A Intent Router
 *
 * Routes user messages to the appropriate blockchain agent based on:
 * 1. Explicit agent mention (e.g., "@somnia deploy this")
 * 2. Chain-specific keywords (e.g., "create an ERC20 token")
 * 3. Default agent when no specific match
 */

import { type AgentConfig, getAllAgents, getActiveAgentsSync, getAgentSync } from "./agents"

export interface RouteResult {
  agent: AgentConfig
  confidence: "explicit" | "keyword" | "default"
  matchedKeywords?: string[]
}

export interface RouteOptions {
  /** Filter routing to only these agent IDs. If empty/undefined, all active agents are considered. */
  selectedAgentIds?: string[]
}

/**
 * Filter agents by selected IDs
 */
function filterBySelection(agents: AgentConfig[], selectedIds?: string[]): AgentConfig[] {
  if (!selectedIds || selectedIds.length === 0) {
    return agents
  }
  const idSet = new Set(selectedIds)
  return agents.filter((a) => idSet.has(a.id))
}

/**
 * Check if message explicitly mentions an agent
 */
function checkExplicitMention(message: string, selectedIds?: string[]): AgentConfig | null {
  const lowerMessage = message.toLowerCase()
  const agents = filterBySelection(getAllAgents(), selectedIds)
  const agentMap = new Map(agents.map((a) => [a.id, a]))

  // Check for @agent pattern
  const atPattern = /@(\w+)/g
  let match
  while ((match = atPattern.exec(lowerMessage)) !== null) {
    const agentId = match[1]
    const agent = agentMap.get(agentId)
    if (agent) {
      return agent
    }
  }

  // Check for "use <agent>" pattern
  const usePattern = /\buse\s+(\w+)\b/i
  const useMatch = lowerMessage.match(usePattern)
  if (useMatch) {
    const agent = agentMap.get(useMatch[1])
    if (agent) {
      return agent
    }
  }

  // Check for "on <agent>" pattern
  const onPattern = /\bon\s+(\w+)\s+(chain|network|blockchain)?\b/i
  const onMatch = lowerMessage.match(onPattern)
  if (onMatch) {
    const agent = agentMap.get(onMatch[1])
    if (agent) {
      return agent
    }
  }

  return null
}

/**
 * Check for keyword matches in the message
 */
function checkKeywordMatch(message: string, selectedIds?: string[]): { agent: AgentConfig; keywords: string[] } | null {
  const lowerMessage = message.toLowerCase()
  const activeAgents = filterBySelection(getActiveAgentsSync(), selectedIds)

  let bestMatch: { agent: AgentConfig; keywords: string[]; score: number } | null = null

  for (const agent of activeAgents) {
    const matchedKeywords: string[] = []

    for (const keyword of agent.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword)
      }
    }

    if (matchedKeywords.length > 0) {
      const score = matchedKeywords.length
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { agent, keywords: matchedKeywords, score }
      }
    }
  }

  return bestMatch ? { agent: bestMatch.agent, keywords: bestMatch.keywords } : null
}

/**
 * Get the default agent (first active agent from selection, or somnia fallback)
 */
function getDefaultAgent(selectedIds?: string[]): AgentConfig | null {
  const activeAgents = filterBySelection(getActiveAgentsSync(), selectedIds)
  if (activeAgents.length > 0) {
    return activeAgents[0]
  }
  // If selection was provided but no agents match, return null
  if (selectedIds && selectedIds.length > 0) {
    return null
  }
  // Ultimate fallback when no selection filter
  const somnia = getAgentSync("somnia")
  if (somnia) {
    return somnia
  }
  // Should never reach here, but provide a safe default
  return {
    id: "somnia",
    name: "Somnia Agent",
    description: "High-performance EVM L1",
    url: process.env.SOMNIA_AGENT_URL || "http://localhost:4001",
    chainId: 50312,
    status: "active",
    keywords: ["somnia", "solidity"],
  }
}

/**
 * Route a message to the appropriate agent
 * @param message - The user's message
 * @param options - Routing options including selected agent filter
 * @returns RouteResult or null if no agents available in selection
 */
export function routeMessage(message: string, options?: RouteOptions): RouteResult | null {
  const selectedIds = options?.selectedAgentIds

  // 1. Check explicit mention (within selected agents)
  const explicitAgent = checkExplicitMention(message, selectedIds)
  if (explicitAgent && explicitAgent.status === "active") {
    return {
      agent: explicitAgent,
      confidence: "explicit",
    }
  }

  // 2. Check keyword matches (within selected agents)
  const keywordMatch = checkKeywordMatch(message, selectedIds)
  if (keywordMatch) {
    return {
      agent: keywordMatch.agent,
      confidence: "keyword",
      matchedKeywords: keywordMatch.keywords,
    }
  }

  // 3. Default to first active agent from selection
  const defaultAgent = getDefaultAgent(selectedIds)
  if (!defaultAgent) {
    return null // No agents available in selection
  }

  return {
    agent: defaultAgent,
    confidence: "default",
  }
}

/**
 * Check if a message should be routed to an A2A agent
 * Returns true if the message contains blockchain-related content
 */
export function shouldRouteToA2A(message: string): boolean {
  const lowerMessage = message.toLowerCase()

  // Check for explicit agent mention
  if (checkExplicitMention(message)) {
    return true
  }

  // Check for blockchain-related keywords
  const blockchainKeywords = [
    "blockchain",
    "smart contract",
    "solidity",
    "deploy",
    "token",
    "erc20",
    "erc721",
    "nft",
    "transaction",
    "wallet",
    "chain",
    "web3",
    "defi",
    "dapp",
    "on-chain",
    "onchain",
    "contract",
    // Store agent keywords
    "store",
    "shop",
    "buy",
    "purchase",
    "stationery",
    "catalog",
    // Payment agent keywords
    "pay",
    "payment",
    "x402",
    "usdc",
    "checkout",
  ]

  for (const keyword of blockchainKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true
    }
  }

  return false
}
