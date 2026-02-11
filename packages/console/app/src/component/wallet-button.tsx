/**
 * Wallet Button Component
 *
 * Displays wallet connection status and provides connect/disconnect actions.
 * Shows connected address and network when connected.
 */

import { Show, For } from "solid-js"
import { useWallet, SUPPORTED_CHAINS, type SupportedChainId } from "~/context/wallet"
import "./wallet-button.css"

export function WalletButton() {
  const wallet = useWallet()

  return (
    <div data-component="wallet-button">
      <Show
        when={wallet.isConnected()}
        fallback={
          <button
            type="button"
            data-slot="connect-button"
            onClick={() => wallet.connect()}
            disabled={wallet.isConnecting() || !wallet.hasProvider()}
          >
            <WalletIcon />
            <Show when={wallet.isConnecting()} fallback={<span>Connect Wallet</span>}>
              <span>Connecting...</span>
            </Show>
          </button>
        }
      >
        <div data-slot="connected-wrapper">
          {/* Network indicator */}
          <Show when={wallet.getChainInfo()}>
            {(chain) => (
              <button
                type="button"
                data-slot="network-button"
                data-supported={wallet.isSupportedChain()}
                title={chain().name}
              >
                <NetworkIcon />
                <span>{chain().symbol}</span>
              </button>
            )}
          </Show>

          {/* Address dropdown */}
          <div data-slot="address-dropdown">
            <button type="button" data-slot="address-button">
              <span>{wallet.formatAddress(wallet.address())}</span>
              <ChevronIcon />
            </button>

            <div data-slot="dropdown-content">
              <div data-slot="dropdown-header">
                <span data-slot="label">Connected</span>
                <span data-slot="address">{wallet.address()}</span>
              </div>

              <div data-slot="dropdown-separator" />

              <div data-slot="dropdown-section">
                <span data-slot="section-label">Switch Network</span>
                <For each={Object.entries(SUPPORTED_CHAINS)}>
                  {([chainId, chain]) => (
                    <button
                      type="button"
                      data-slot="network-item"
                      data-active={wallet.chainId() === parseInt(chainId)}
                      onClick={() => wallet.switchChain(parseInt(chainId) as SupportedChainId)}
                    >
                      <span>{chain.name}</span>
                      <Show when={wallet.chainId() === parseInt(chainId)}>
                        <CheckIcon />
                      </Show>
                    </button>
                  )}
                </For>
              </div>

              <div data-slot="dropdown-separator" />

              <button type="button" data-slot="disconnect-button" onClick={() => wallet.disconnect()}>
                <DisconnectIcon />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Error display */}
      <Show when={wallet.error()}>
        <div data-slot="error-message">{wallet.error()}</div>
      </Show>

      {/* No provider warning */}
      <Show when={!wallet.hasProvider() && !wallet.isConnected()}>
        <div data-slot="no-provider">
          <a href="https://metamask.io" target="_blank" rel="noopener noreferrer">
            Install MetaMask
          </a>
        </div>
      </Show>
    </div>
  )
}

// Icon components
function WalletIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14.25 5.25H3.75C3.33579 5.25 3 5.58579 3 6V14.25C3 14.6642 3.33579 15 3.75 15H14.25C14.6642 15 15 14.6642 15 14.25V6C15 5.58579 14.6642 5.25 14.25 5.25Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12 5.25V3.75C12 3.35218 11.842 2.97064 11.5607 2.68934C11.2794 2.40804 10.8978 2.25 10.5 2.25H4.5C4.10218 2.25 3.72064 2.40804 3.43934 2.68934C3.15804 2.97064 3 3.35218 3 3.75V6"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12.75 10.875C12.75 11.2892 12.4142 11.625 12 11.625C11.5858 11.625 11.25 11.2892 11.25 10.875C11.25 10.4608 11.5858 10.125 12 10.125C12.4142 10.125 12.75 10.4608 12.75 10.875Z"
        fill="currentColor"
      />
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.5" />
      <path d="M7 1.5V12.5" stroke="currentColor" stroke-width="1.5" />
      <path d="M1.5 7H12.5" stroke="currentColor" stroke-width="1.5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  )
}

function DisconnectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.25 7H12.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <path d="M9.25 4L12.25 7L9.25 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      <path
        d="M8.75 2.5H3.5C2.67157 2.5 2 3.17157 2 4V10C2 10.8284 2.67157 11.5 3.5 11.5H8.75"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  )
}
