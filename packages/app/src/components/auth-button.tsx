/**
 * Auth Button Component
 *
 * Displays Google authentication status in the titlebar.
 * Uses IAP for production, gcloud CLI for local development.
 */

import { Show } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { useAuth } from "@/context/auth"

export function AuthButton() {
  const auth = useAuth()

  return (
    <Show
      when={auth.isAuthenticated()}
      fallback={
        <Show when={!auth.isLoading()}>
          <Button
            variant="ghost"
            class="h-6 px-2 gap-1.5 text-12-regular"
            onClick={() => {
              // In production, IAP will have already authenticated
              // This fallback is for edge cases - just refresh
              auth.refresh()
            }}
          >
            <Icon name="link" size="small" />
            <span>Sign in with Google</span>
          </Button>
        </Show>
      }
    >
      <DropdownMenu>
        <DropdownMenu.Trigger as={Button} variant="ghost" class="h-6 px-2 gap-1.5 text-12-regular">
          <div class="size-1.5 rounded-full bg-icon-success-base" />
          <span>{auth.formatEmail(auth.email())}</span>
          <Icon name="chevron-down" size="small" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="min-w-[220px]">
            {/* User info */}
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel class="text-11-regular text-text-weak px-3 py-1.5">
                Google Account
              </DropdownMenu.GroupLabel>
              <div class="px-3 py-1.5 text-12-regular text-text-base truncate">{auth.email()}</div>
              <Show when={auth.source()}>
                <div class="px-3 py-1 text-11-regular text-text-dimmed">
                  via {auth.source() === "iap" ? "Cloud IAP" : "gcloud CLI"}
                </div>
              </Show>
            </DropdownMenu.Group>

            <DropdownMenu.Separator />

            {/* Sign out */}
            <DropdownMenu.Item
              class="flex items-center gap-2 px-3 py-1.5 text-text-critical"
              onSelect={() => auth.signOut()}
            >
              <Icon name="close" size="small" />
              <span class="text-14-regular">Sign out</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  )
}
