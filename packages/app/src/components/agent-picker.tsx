/**
 * Agent Picker Component
 *
 * Multi-select dropdown for blockchain agents in the chat header/toolbar.
 * Shows available agents with health indicators and allows toggling selection.
 */

import { Component, createEffect, For, Show, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Popover as Kobalte } from "@kobalte/core/popover"
import { useAgents } from "@/context/agents"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Checkbox } from "@opencode-ai/ui/checkbox"
import { Spinner } from "@opencode-ai/ui/spinner"
import { Tooltip } from "@opencode-ai/ui/tooltip"

export const AgentPicker: Component = () => {
  const agents = useAgents()

  const [store, setStore] = createStore({
    open: false,
  })

  // Load agents on mount
  onMount(() => {
    if (!agents.initialized) {
      agents.loadAgents()
    }
  })

  // Refresh health when dropdown opens
  createEffect(() => {
    if (store.open && agents.initialized) {
      agents.refreshHealth()
    }
  })

  return (
    <Kobalte open={store.open} onOpenChange={(open) => setStore("open", open)} placement="top-start" gutter={8}>
      <Kobalte.Trigger as={Button} variant="ghost" class="min-w-0 max-w-[180px] gap-1.5">
        <Icon name="providers" size="small" class="shrink-0" />
        <span class="truncate text-12-regular">
          <Show when={agents.initialized} fallback="Agents">
            {agents.selectedCount() === 1
              ? (agents.selectedAgents()[0]?.name ?? "Agents")
              : `${agents.selectedCount()} Agents`}
          </Show>
        </span>
        <Icon name="chevron-down" size="small" class="shrink-0" />
      </Kobalte.Trigger>

      <Kobalte.Portal>
        <Kobalte.Content
          class="w-72 flex flex-col rounded-md border border-border-base bg-surface-raised-stronger-non-alpha shadow-md z-50 outline-none overflow-hidden"
          onEscapeKeyDown={() => setStore("open", false)}
          onPointerDownOutside={() => setStore("open", false)}
          onFocusOutside={() => setStore("open", false)}
        >
          <Kobalte.Title class="sr-only">Select Blockchain Agents</Kobalte.Title>

          {/* Header */}
          <div class="flex items-center justify-between px-3 py-2 border-b border-border-base">
            <span class="text-12-medium text-text-strong">Blockchain Agents</span>
            <Show when={agents.loading.health}>
              <Spinner class="size-4" />
            </Show>
          </div>

          {/* Agent List */}
          <div class="flex flex-col py-1 max-h-64 overflow-y-auto">
            <Show
              when={!agents.loading.agents}
              fallback={
                <div class="flex items-center justify-center py-4">
                  <Spinner class="size-5" />
                </div>
              }
            >
              <Show
                when={agents.agents.length > 0}
                fallback={
                  <div class="px-3 py-4 text-center text-12-regular text-text-weak">
                    <Show when={agents.errors.agents} fallback="No agents available">
                      <span class="text-text-error">{agents.errors.agents}</span>
                    </Show>
                  </div>
                }
              >
                <For each={agents.agents}>
                  {(agent) => {
                    const health = () => agents.getAgentHealth(agent.id)
                    const isSelected = () => agents.isAgentSelected(agent.id)

                    return (
                      <button
                        type="button"
                        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-raised-base-hover cursor-pointer text-left"
                        onClick={() => agents.toggleAgent(agent.id)}
                      >
                        <Checkbox checked={isSelected()} class="shrink-0" />

                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-13-regular text-text-strong truncate">{agent.name}</span>
                            <Show when={!agent.enabled}>
                              <span class="text-10-regular text-text-weak px-1 py-0.5 bg-surface-base rounded">
                                disabled
                              </span>
                            </Show>
                          </div>
                          <p class="text-11-regular text-text-weak truncate">{agent.description}</p>
                        </div>

                        {/* Health Indicator */}
                        <Tooltip
                          placement="left"
                          value={
                            health()
                              ? health()!.healthy
                                ? `Online (${health()!.latencyMs}ms)`
                                : (health()!.error ?? "Offline")
                              : "Unknown"
                          }
                        >
                          <div class="shrink-0">
                            <Show when={health()} fallback={<div class="size-2 rounded-full bg-surface-base" />}>
                              <div
                                class="size-2 rounded-full"
                                classList={{
                                  "bg-green-500": health()?.healthy,
                                  "bg-red-500": !health()?.healthy,
                                }}
                              />
                            </Show>
                          </div>
                        </Tooltip>
                      </button>
                    )
                  }}
                </For>
              </Show>
            </Show>
          </div>

          {/* Footer */}
          <Show when={agents.agents.length > 1}>
            <div class="flex items-center justify-between px-3 py-2 border-t border-border-base">
              <button
                type="button"
                class="text-11-regular text-text-weak hover:text-text-base"
                onClick={() => agents.selectAll()}
              >
                Select all
              </button>
              <span class="text-11-regular text-text-weak">{agents.selectedCount()} selected</span>
            </div>
          </Show>
        </Kobalte.Content>
      </Kobalte.Portal>
    </Kobalte>
  )
}
