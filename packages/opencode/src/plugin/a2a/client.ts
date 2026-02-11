/**
 * A2A Client Wrapper
 *
 * Wraps the A2A SDK for communicating with blockchain agents.
 * Handles message sending, agent card fetching, and error handling.
 */

import { Log } from "../../util/log"

const log = Log.create({ service: "plugin.a2a.client" })

/**
 * A2A Message Part (simplified from SDK)
 */
export interface MessagePart {
  kind: "text" | "file" | "data"
  text?: string
  file?: {
    name: string
    mimeType: string
    bytes?: string // base64
    uri?: string
  }
  data?: Record<string, unknown>
}

/**
 * A2A Message
 */
export interface Message {
  messageId: string
  role: "user" | "agent"
  parts: MessagePart[]
}

/**
 * A2A Agent Card
 */
export interface AgentCard {
  name: string
  description: string
  url: string
  version: string
  capabilities: {
    streaming: boolean
    pushNotifications: boolean
    stateTransitionHistory: boolean
  }
  skills: Array<{
    id: string
    name: string
    description: string
    tags: string[]
    examples: string[]
  }>
  defaultInputModes: string[]
  defaultOutputModes: string[]
}

/**
 * A2A JSON-RPC Response
 */
export interface A2AResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: {
    id: string
    status: {
      state: "submitted" | "working" | "input-required" | "completed" | "failed" | "canceled"
      message?: Message
      timestamp: string
    }
    artifacts?: Array<{
      artifactId: string
      name: string
      parts: MessagePart[]
    }>
    history?: Array<{
      state: string
      message?: Message
      timestamp: string
    }>
  }
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Send a message to an A2A agent
 */
export async function sendMessage(
  agentUrl: string,
  text: string,
  options?: {
    timeout?: number
    taskId?: string
  },
): Promise<A2AResponse> {
  const requestId = generateRequestId()
  const messageId = generateMessageId()
  const timeout = options?.timeout ?? 60000

  const requestBody = {
    jsonrpc: "2.0" as const,
    id: requestId,
    method: options?.taskId ? "message/send" : "message/send",
    params: {
      ...(options?.taskId && { id: options.taskId }),
      message: {
        messageId,
        role: "user" as const,
        parts: [
          {
            kind: "text" as const,
            text,
          },
        ],
      },
    },
  }

  log.info("sending a2a message", { agentUrl, requestId, messageId })

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`A2A request failed: ${response.status} ${response.statusText}`)
    }

    const result: A2AResponse = await response.json()

    if (result.error) {
      log.error("a2a error response", { error: result.error })
      throw new Error(`A2A error: ${result.error.message}`)
    }

    log.info("a2a response received", {
      requestId,
      state: result.result?.status?.state,
    })

    return result
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`A2A request timed out after ${timeout}ms`)
    }
    throw err
  }
}

/**
 * Fetch an agent's card (capabilities and skills)
 */
export async function getAgentCard(agentUrl: string): Promise<AgentCard> {
  // Try the well-known path first
  const wellKnownUrl = new URL("/.well-known/agent.json", agentUrl)

  log.info("fetching agent card", { url: wellKnownUrl.toString() })

  try {
    let response = await fetch(wellKnownUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    })

    // Fall back to /agent.json if well-known path fails
    if (!response.ok) {
      const fallbackUrl = new URL("/agent.json", agentUrl)
      response = await fetch(fallbackUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      })
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch agent card: ${response.status}`)
    }

    const card: AgentCard = await response.json()
    log.info("agent card fetched", { name: card.name, skills: card.skills?.length })
    return card
  } catch (err) {
    log.error("failed to fetch agent card", { error: err })
    throw err
  }
}

/**
 * Check if an agent is healthy/reachable
 */
export async function checkAgentHealth(agentUrl: string): Promise<boolean> {
  try {
    const healthUrl = new URL("/health", agentUrl)
    const response = await fetch(healthUrl.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Extract text from A2A response
 */
export function extractResponseText(response: A2AResponse): string {
  const parts: string[] = []

  // Extract from status message
  const statusMessage = response.result?.status?.message
  if (statusMessage?.parts) {
    for (const part of statusMessage.parts) {
      if (part.kind === "text" && part.text) {
        parts.push(part.text)
      }
    }
  }

  // Extract from artifacts
  if (response.result?.artifacts) {
    for (const artifact of response.result.artifacts) {
      for (const part of artifact.parts) {
        if (part.kind === "text" && part.text) {
          parts.push(`\n--- ${artifact.name} ---\n${part.text}`)
        }
      }
    }
  }

  return parts.join("\n\n")
}
