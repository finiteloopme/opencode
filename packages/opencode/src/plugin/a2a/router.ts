/**
 * A2A Intent Router
 *
 * Routes user messages to the appropriate blockchain agent based on:
 * 1. Explicit agent mention (e.g., "@somnia deploy this")
 * 2. Chain-specific keywords (e.g., "create an ERC20 token")
 * 3. Default agent when no specific match
 */

import { AGENTS, type AgentConfig, getActiveAgents } from "./agents"

export interface RouteResult {
  agent: AgentConfig
  confidence: "explicit" | "keyword" | "default"
  matchedKeywords?: string[]
}

/**
 * Check if message explicitly mentions an agent
 */
function checkExplicitMention(message: string): AgentConfig | null {
  const lowerMessage = message.toLowerCase()

  // Check for @agent pattern
  const atPattern = /@(\w+)/g
  let match
  while ((match = atPattern.exec(lowerMessage)) !== null) {
    const agentId = match[1]
    if (AGENTS[agentId]) {
      return AGENTS[agentId]
    }
  }

  // Check for "use <agent>" pattern
  const usePattern = /\buse\s+(\w+)\b/i
  const useMatch = lowerMessage.match(usePattern)
  if (useMatch && AGENTS[useMatch[1]]) {
    return AGENTS[useMatch[1]]
  }

  // Check for "on <agent>" pattern
  const onPattern = /\bon\s+(\w+)\s+(chain|network|blockchain)?\b/i
  const onMatch = lowerMessage.match(onPattern)
  if (onMatch && AGENTS[onMatch[1]]) {
    return AGENTS[onMatch[1]]
  }

  return null
}

/**
 * Check for keyword matches in the message
 */
function checkKeywordMatch(message: string): { agent: AgentConfig; keywords: string[] } | null {
  const lowerMessage = message.toLowerCase()
  const activeAgents = getActiveAgents()

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
 * Get the default agent (first active agent, or somnia)
 */
function getDefaultAgent(): AgentConfig {
  const activeAgents = getActiveAgents()
  return activeAgents.length > 0 ? activeAgents[0] : AGENTS.somnia
}

/**
 * Route a message to the appropriate agent
 */
export function routeMessage(message: string): RouteResult {
  // 1. Check explicit mention
  const explicitAgent = checkExplicitMention(message)
  if (explicitAgent && explicitAgent.status === "active") {
    return {
      agent: explicitAgent,
      confidence: "explicit",
    }
  }

  // 2. Check keyword matches
  const keywordMatch = checkKeywordMatch(message)
  if (keywordMatch) {
    return {
      agent: keywordMatch.agent,
      confidence: "keyword",
      matchedKeywords: keywordMatch.keywords,
    }
  }

  // 3. Default to first active agent
  return {
    agent: getDefaultAgent(),
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
  ]

  for (const keyword of blockchainKeywords) {
    if (lowerMessage.includes(keyword)) {
      return true
    }
  }

  return false
}
