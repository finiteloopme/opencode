/**
 * Wallet Button Component
 *
 * Displays wallet connection status in the titlebar.
 * Uses the app's UI components and Tailwind styling.
 */

import { Show, For } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { DropdownMenu } from "@opencode-ai/ui/dropdown-menu"
import { Icon } from "@opencode-ai/ui/icon"
import { useWallet, SUPPORTED_CHAINS, type SupportedChainId } from "@/context/wallet"
import { usePlatform } from "@/context/platform"

export function WalletButton() {
  const wallet = useWallet()
  const platform = usePlatform()

  const openMetaMask = () => {
    platform.openLink("https://metamask.io/download/")
  }

  return (
    <Show
      when={wallet.isConnected()}
      fallback={
        <Button
          variant="ghost"
          class="h-6 px-2 gap-1.5 text-12-regular"
          onClick={() => (wallet.hasProvider() ? wallet.connect() : openMetaMask())}
          disabled={wallet.isConnecting()}
        >
          <Icon name="wallet" size="small" />
          <Show when={wallet.isConnecting()} fallback={<span>Connect Wallet</span>}>
            <span>Connecting...</span>
          </Show>
        </Button>
      }
    >
      <DropdownMenu>
        <DropdownMenu.Trigger as={Button} variant="ghost" class="h-6 px-2 gap-1.5 text-12-regular">
          <Show when={wallet.isSupportedChain()}>
            <div class="size-1.5 rounded-full bg-icon-success-base" />
          </Show>
          <Show when={!wallet.isSupportedChain()}>
            <div class="size-1.5 rounded-full bg-icon-warning-base" />
          </Show>
          <span>{wallet.formatAddress(wallet.address())}</span>
          <Icon name="chevron-down" size="small" />
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content class="min-w-[200px]">
            {/* Connected address */}
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel class="text-11-regular text-text-weak px-3 py-1.5">
                Connected
              </DropdownMenu.GroupLabel>
              <div class="px-3 py-1.5 text-12-regular text-text-base font-mono truncate">{wallet.address()}</div>
            </DropdownMenu.Group>

            <DropdownMenu.Separator />

            {/* Network switcher */}
            <DropdownMenu.Group>
              <DropdownMenu.GroupLabel class="text-11-regular text-text-weak px-3 py-1.5">
                Switch Network
              </DropdownMenu.GroupLabel>
              <For each={Object.entries(SUPPORTED_CHAINS)}>
                {([chainId, chain]) => {
                  const isActive = () => wallet.chainId() === parseInt(chainId)
                  return (
                    <DropdownMenu.Item
                      class="flex items-center justify-between gap-2 px-3 py-1.5"
                      onSelect={() => wallet.switchChain(parseInt(chainId) as SupportedChainId)}
                    >
                      <span class="text-14-regular">{chain.name}</span>
                      <Show when={isActive()}>
                        <Icon name="check" size="small" class="text-icon-success-base" />
                      </Show>
                    </DropdownMenu.Item>
                  )
                }}
              </For>
            </DropdownMenu.Group>

            <DropdownMenu.Separator />

            {/* Disconnect */}
            <DropdownMenu.Item
              class="flex items-center gap-2 px-3 py-1.5 text-text-critical"
              onSelect={() => wallet.disconnect()}
            >
              <Icon name="close" size="small" />
              <span class="text-14-regular">Disconnect</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu>
    </Show>
  )
}
