/**
 * Agent Context
 *
 * Manages blockchain agent state for the multi-agent selector:
 * - Available agents (fetched from registry via backend proxy)
 * - Selected agents (session-only, defaults to all enabled)
 * - Health status (lazy-loaded when picker is opened)
 */

import { createStore } from "solid-js/store"
import { createMemo } from "solid-js"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { fetchAgents, fetchAgentHealth, type AgentInfo, type AgentHealthStatus } from "@/lib/agents"
import { useServer } from "./server"

export interface AgentState {
  /** All available agents from registry */
  agents: AgentInfo[]
  /** IDs of currently selected agents */
  selectedIds: string[]
  /** Health status by agent ID */
  health: Record<string, AgentHealthStatus>
  /** Loading states */
  loading: {
    agents: boolean
    health: boolean
  }
  /** Error messages */
  errors: {
    agents: string | null
    health: string | null
  }
  /** Whether agents have been fetched at least once */
  initialized: boolean
}

const initialState: AgentState = {
  agents: [],
  selectedIds: [],
  health: {},
  loading: {
    agents: false,
    health: false,
  },
  errors: {
    agents: null,
    health: null,
  },
  initialized: false,
}

export const { use: useAgents, provider: AgentsProvider } = createSimpleContext({
  name: "Agents",
  init: () => {
    const server = useServer()
    const [store, setStore] = createStore<AgentState>(initialState)

    /**
     * Fetch available agents from registry (via backend proxy).
     * On first load, selects all enabled agents by default.
     */
    async function loadAgents() {
      if (store.loading.agents) return

      setStore("loading", "agents", true)
      setStore("errors", "agents", null)

      try {
        const agents = await fetchAgents(server.url)
        setStore("agents", agents)

        // On first load, select all enabled agents by default
        if (!store.initialized) {
          const enabledIds = agents.filter((a) => a.enabled).map((a) => a.id)
          setStore("selectedIds", enabledIds)
          setStore("initialized", true)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load agents"
        setStore("errors", "agents", message)
      } finally {
        setStore("loading", "agents", false)
      }
    }

    /**
     * Fetch health status for all agents (via backend proxy).
     * Called lazily when the agent picker is opened.
     */
    async function refreshHealth() {
      if (store.loading.health) return

      setStore("loading", "health", true)
      setStore("errors", "health", null)

      try {
        const healthStatuses = await fetchAgentHealth(server.url)

        // Convert array to record by ID
        const healthMap: Record<string, AgentHealthStatus> = {}
        for (const status of healthStatuses) {
          healthMap[status.id] = status
        }

        setStore("health", healthMap)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check agent health"
        setStore("errors", "health", message)
      } finally {
        setStore("loading", "health", false)
      }
    }

    /**
     * Toggle selection of an agent
     */
    function toggleAgent(id: string) {
      const current = store.selectedIds
      const isSelected = current.includes(id)

      if (isSelected) {
        // Don't allow deselecting the last agent
        if (current.length === 1) return
        setStore(
          "selectedIds",
          current.filter((i) => i !== id),
        )
      } else {
        setStore("selectedIds", [...current, id])
      }
    }

    /**
     * Select all agents
     */
    function selectAll() {
      const allIds = store.agents.filter((a) => a.enabled).map((a) => a.id)
      setStore("selectedIds", allIds)
    }

    /**
     * Deselect all agents (keeps at least one)
     */
    function deselectAll() {
      // Keep the first enabled agent selected
      const first = store.agents.find((a) => a.enabled)
      if (first) {
        setStore("selectedIds", [first.id])
      }
    }

    // Derived state
    const selectedAgents = createMemo(() => store.agents.filter((a) => store.selectedIds.includes(a.id)))

    const selectedCount = createMemo(() => store.selectedIds.length)

    const isAgentSelected = (id: string) => store.selectedIds.includes(id)

    const getAgentHealth = (id: string) => store.health[id]

    return {
      // State accessors
      get agents() {
        return store.agents
      },
      get selectedIds() {
        return store.selectedIds
      },
      get health() {
        return store.health
      },
      get loading() {
        return store.loading
      },
      get errors() {
        return store.errors
      },
      get initialized() {
        return store.initialized
      },

      // Derived state
      selectedAgents,
      selectedCount,
      isAgentSelected,
      getAgentHealth,

      // Actions
      loadAgents,
      refreshHealth,
      toggleAgent,
      selectAll,
      deselectAll,
    }
  },
})

// Re-export types for convenience
export type { AgentInfo, AgentHealthStatus }
