/**
 * A2A Plugin for OpenCode
 *
 * Provides tools for interacting with blockchain A2A agents:
 * - a2a-send: Send messages to blockchain agents (auto-routes or explicit)
 * - a2a-agents: List available agents and their status
 * - a2a-capabilities: Get agent card/skills
 *
 * Agent Selection:
 * - Users can select which agents are available via the frontend agent picker
 * - Selection is passed through PromptInput.selectedAgentIds
 * - Filtering is deterministic: session selection overrides LLM args
 * - Default agents are configured via A2A_DEFAULT_AGENTS env var
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { Log } from "../../util/log"
import { getAllAgents, getAgent, isAgentAvailable, initializeAgents, type AgentConfig } from "./agents"
import { routeMessage, shouldRouteToA2A } from "./router"
import { sendMessage, getAgentCard, checkAgentHealth, extractResponseText } from "./client"
import { getDefaultAgentIds } from "./config"

const log = Log.create({ service: "plugin.a2a" })

/**
 * Session-scoped agent selection state (ephemeral)
 * Maps sessionID -> selected agent IDs
 * Cleared when session ends or on refresh
 */
const sessionAgentSelection = new Map<string, string[]>()

/**
 * Format agent info for display
 */
function formatAgentInfo(agent: AgentConfig, healthy?: boolean): string {
  const status = healthy !== undefined ? (healthy ? "online" : "offline") : agent.status
  return `- **${agent.name}** (${agent.id})
  Status: ${status}
  Description: ${agent.description}
  Chain ID: ${agent.chainId}
  URL: ${agent.url}`
}

export async function A2APlugin(_input: PluginInput): Promise<Hooks> {
  log.info("initializing a2a plugin")

  // Initialize agents from registry (or fallback to static)
  await initializeAgents()

  return {
    tool: {
      /**
       * Send a message to a blockchain A2A agent
       */
      "a2a-send": tool({
        description: `Send a message to a blockchain A2A agent. 
The message will be automatically routed to the appropriate agent based on content, 
or you can specify an agent explicitly.

IMPORTANT: When asking an agent to compile code, include the full source code in the 
message OR use the artifacts parameter. Agents maintain session state, so after generating 
code you can simply say "compile" and the agent will use the previously generated code.

Use this for blockchain operations like:
- Generating smart contracts (Midnight Compact, Solidity)
- Compiling contracts (include full source code or use artifacts param)
- Deploying contracts
- Checking transaction status
- Querying on-chain state

Note: Agent filtering is determined by user's session selection (set via UI agent picker).
The selectedAgents argument is ignored if a session selection exists.`,
        args: {
          message: tool.schema.string().describe("The message to send to the blockchain agent"),
          agent: tool.schema
            .string()
            .optional()
            .describe("Optional: Specific agent ID (somnia, sonic, midnight). Auto-routes if not specified."),
          timeout: tool.schema
            .number()
            .optional()
            .describe("Optional: Request timeout in milliseconds (default: 60000)"),
          artifacts: tool.schema
            .array(
              tool.schema.object({
                name: tool.schema.string().describe("Filename (e.g., 'contract.compact')"),
                content: tool.schema.string().describe("File content"),
                mimeType: tool.schema.string().optional().describe("MIME type (default: text/plain)"),
              }),
            )
            .optional()
            .describe("Optional: File artifacts to include with the message (e.g., source code files)"),
        },
        async execute(args, _context) {
          const { message, agent: agentId, timeout, artifacts } = args

          // Deterministic agent filtering:
          // 1. Session selection (from frontend agent picker) takes precedence
          // 2. Falls back to config default (A2A_DEFAULT_AGENTS)
          const sessionSelection = sessionAgentSelection.get(_context.sessionID)
          const effectiveFilter = sessionSelection ?? getDefaultAgentIds()

          log.info("a2a-send called", {
            message: message.substring(0, 100),
            agentId,
            sessionSelection: sessionSelection ?? "none",
            effectiveFilter,
          })

          // Determine which agent to use
          let targetAgent: AgentConfig

          if (agentId) {
            // Explicit agent specified
            const agent = await getAgent(agentId)
            if (!agent) {
              return `Error: Unknown agent "${agentId}". Available agents: ${getAllAgents()
                .map((a) => a.id)
                .join(", ")}`
            }
            // Check if agent is in effective filter (deterministic check)
            if (effectiveFilter.length > 0 && !effectiveFilter.includes(agentId)) {
              return `Error: Agent "${agentId}" is not in the allowed agents list. Allowed: ${effectiveFilter.join(", ")}. Adjust your agent selection in the UI to include this agent.`
            }
            if (!(await isAgentAvailable(agentId))) {
              return `Error: Agent "${agentId}" is not currently available (status: ${agent.status})`
            }
            targetAgent = agent
          } else {
            // Auto-route based on message content, filtered by effective selection
            const route = routeMessage(message, { selectedAgentIds: effectiveFilter })
            if (!route) {
              const availableAgents = getAllAgents()
                .map((a) => a.id)
                .join(", ")
              return `Error: No agents available for routing. ${effectiveFilter.length ? `Allowed agents (${effectiveFilter.join(", ")}) are not available or don't match any active agents.` : ""} All registered agents: ${availableAgents}`
            }
            targetAgent = route.agent

            log.info("auto-routed message", {
              agent: targetAgent.id,
              confidence: route.confidence,
              keywords: route.matchedKeywords,
              effectiveFilter,
            })
          }

          // Check agent health
          const isHealthy = await checkAgentHealth(targetAgent.url)
          if (!isHealthy) {
            return `Error: Agent "${targetAgent.name}" at ${targetAgent.url} is not reachable. Please ensure the agent is running.`
          }

          // Send the message with OpenCode session ID as A2A context ID
          // This maintains session continuity across multiple calls (e.g., compile → deploy)
          try {
            const response = await sendMessage(targetAgent.url, message, {
              timeout,
              contextId: _context.sessionID,
              artifacts,
            })

            // Check for errors
            if (response.error) {
              return `Error from ${targetAgent.name}: ${response.error.message}`
            }

            // Extract text from response
            const responseText = extractResponseText(response)

            if (!responseText) {
              return `${targetAgent.name} acknowledged the request but returned no text content. Task state: ${response.result?.status?.state}`
            }

            // Format the response
            const header = `**Response from ${targetAgent.name}**\nTask State: ${response.result?.status?.state}\n\n`
            return header + responseText
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            log.error("a2a-send error", { error, agent: targetAgent.id })
            return `Error communicating with ${targetAgent.name}: ${error}`
          }
        },
      }),

      /**
       * List available A2A agents
       */
      "a2a-agents": tool({
        description: "List all available blockchain A2A agents and their status",
        args: {
          checkHealth: tool.schema.boolean().optional().describe("Optional: Check if agents are online (adds latency)"),
        },
        async execute(args, _context) {
          const { checkHealth } = args
          const agents = getAllAgents()

          log.info("a2a-agents called", { checkHealth, count: agents.length })

          const results: string[] = ["# Available Blockchain Agents\n"]

          for (const agent of agents) {
            let healthy: boolean | undefined

            if (checkHealth && agent.status === "active") {
              healthy = await checkAgentHealth(agent.url)
            }

            results.push(formatAgentInfo(agent, healthy))
            results.push("")
          }

          return results.join("\n")
        },
      }),

      /**
       * Get agent capabilities and skills
       */
      "a2a-capabilities": tool({
        description: "Get the capabilities and skills of a specific blockchain A2A agent",
        args: {
          agent: tool.schema.string().describe("Agent ID (somnia, sonic, midnight)"),
        },
        async execute(args, _context) {
          const { agent: agentId } = args

          log.info("a2a-capabilities called", { agentId })

          const agent = await getAgent(agentId)
          if (!agent) {
            return `Error: Unknown agent "${agentId}". Available agents: ${getAllAgents()
              .map((a) => a.id)
              .join(", ")}`
          }

          // Check health first
          const isHealthy = await checkAgentHealth(agent.url)
          if (!isHealthy) {
            return `Error: Agent "${agent.name}" at ${agent.url} is not reachable. Cannot fetch capabilities.`
          }

          try {
            const card = await getAgentCard(agent.url)

            const lines = [
              `# ${card.name}`,
              "",
              `**Description:** ${card.description}`,
              `**Version:** ${card.version}`,
              `**URL:** ${card.url}`,
              "",
              "## Capabilities",
              `- Streaming: ${card.capabilities.streaming ? "Yes" : "No"}`,
              `- Push Notifications: ${card.capabilities.pushNotifications ? "Yes" : "No"}`,
              `- State History: ${card.capabilities.stateTransitionHistory ? "Yes" : "No"}`,
              "",
              "## Skills",
              "",
            ]

            if (card.skills && card.skills.length > 0) {
              for (const skill of card.skills) {
                lines.push(`### ${skill.name} (\`${skill.id}\`)`)
                lines.push(skill.description)
                if (skill.tags.length > 0) {
                  lines.push(`Tags: ${skill.tags.join(", ")}`)
                }
                if (skill.examples.length > 0) {
                  lines.push("\n**Examples:**")
                  for (const example of skill.examples) {
                    lines.push(`- "${example}"`)
                  }
                }
                lines.push("")
              }
            } else {
              lines.push("No skills defined.")
            }

            return lines.join("\n")
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err)
            log.error("a2a-capabilities error", { error, agentId })
            return `Error fetching capabilities for ${agent.name}: ${error}`
          }
        },
      }),
    },

    /**
     * Hook into chat messages to:
     * 1. Capture user's selected agent IDs from the prompt
     * 2. Detect blockchain-related requests (informational)
     */
    "chat.message": async (input, _output) => {
      // Capture agent selection from the prompt (deterministic filtering)
      if (input.selectedAgentIds && input.selectedAgentIds.length > 0) {
        sessionAgentSelection.set(input.sessionID, input.selectedAgentIds)
        log.info("captured agent selection for session", {
          sessionID: input.sessionID,
          selectedAgentIds: input.selectedAgentIds,
        })
      }

      // Log when blockchain-related messages are detected
      const firstPart = _output.parts[0]
      if (firstPart && "text" in firstPart && firstPart.text) {
        const text = firstPart.text
        if (shouldRouteToA2A(text)) {
          const effectiveFilter = sessionAgentSelection.get(input.sessionID) ?? getDefaultAgentIds()
          const route = routeMessage(text, { selectedAgentIds: effectiveFilter })
          if (route) {
            log.info("blockchain-related message detected", {
              sessionID: input.sessionID,
              agent: route.agent.id,
              confidence: route.confidence,
              effectiveFilter,
            })
          }
        }
      }
    },
  }
}

/**
 * Clear session agent selection (call when session ends)
 * Exported for potential use by session cleanup
 */
export function clearSessionAgentSelection(sessionID: string): void {
  sessionAgentSelection.delete(sessionID)
  log.info("cleared agent selection for session", { sessionID })
}

/**
 * Get current session agent selection (for debugging/testing)
 */
export function getSessionAgentSelection(sessionID: string): string[] | undefined {
  return sessionAgentSelection.get(sessionID)
}
