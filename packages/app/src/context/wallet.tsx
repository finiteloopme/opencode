/**
 * Wallet Context for blockchain wallet connection
 *
 * Provides wallet state and actions for connecting to MetaMask/injected providers.
 * Supports Somnia Mainnet (5031) and Somnia Testnet Shannon (50312).
 */

import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"

// Supported chains configuration
export const SUPPORTED_CHAINS = {
  5031: {
    name: "Somnia Mainnet",
    symbol: "SOMI",
    rpcUrl: "https://api.infra.mainnet.somnia.network/",
    blockExplorer: "https://explorer.somnia.network",
  },
  50312: {
    name: "Somnia Testnet (Shannon)",
    symbol: "STT",
    rpcUrl: "https://dream-rpc.somnia.network/",
    blockExplorer: "https://shannon.somnia.network",
  },
} as const

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS

export interface WalletState {
  address: `0x${string}` | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

// Extend Window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export const { use: useWallet, provider: WalletProvider } = createSimpleContext({
  name: "Wallet",
  gate: false, // Don't gate on ready - wallet is optional
  init: () => {
    const [store, setStore] = createStore<WalletState>({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    })

    const [hasProvider, setHasProvider] = createSignal(false)

    // Check for ethereum provider on mount
    createEffect(() => {
      if (typeof window !== "undefined" && window.ethereum) {
        setHasProvider(true)

        // Check if already connected
        window.ethereum
          .request({ method: "eth_accounts" })
          .then((accounts) => {
            const acc = accounts as string[]
            if (acc.length > 0) {
              setStore("address", acc[0] as `0x${string}`)
              setStore("isConnected", true)
            }
          })
          .catch(console.error)

        // Get current chain
        window.ethereum
          .request({ method: "eth_chainId" })
          .then((chainId) => {
            setStore("chainId", parseInt(chainId as string, 16))
          })
          .catch(console.error)

        // Set up event listeners
        const handleAccountsChanged = (accounts: unknown) => {
          const acc = accounts as string[]
          if (acc.length === 0) {
            setStore("address", null)
            setStore("isConnected", false)
          } else {
            setStore("address", acc[0] as `0x${string}`)
            setStore("isConnected", true)
          }
        }

        const handleChainChanged = (chainId: unknown) => {
          setStore("chainId", parseInt(chainId as string, 16))
        }

        const handleDisconnect = () => {
          setStore("address", null)
          setStore("chainId", null)
          setStore("isConnected", false)
        }

        window.ethereum.on("accountsChanged", handleAccountsChanged)
        window.ethereum.on("chainChanged", handleChainChanged)
        window.ethereum.on("disconnect", handleDisconnect)

        onCleanup(() => {
          if (window.ethereum) {
            window.ethereum.removeListener("accountsChanged", handleAccountsChanged)
            window.ethereum.removeListener("chainChanged", handleChainChanged)
            window.ethereum.removeListener("disconnect", handleDisconnect)
          }
        })
      }
    })

    const connect = async () => {
      if (!window.ethereum) {
        setStore("error", "No wallet found. Please install MetaMask.")
        return
      }

      setStore("isConnecting", true)
      setStore("error", null)

      try {
        const accounts = (await window.ethereum.request({
          method: "eth_requestAccounts",
        })) as string[]

        if (accounts.length > 0) {
          setStore("address", accounts[0] as `0x${string}`)
          setStore("isConnected", true)
        }

        const chainId = (await window.ethereum.request({
          method: "eth_chainId",
        })) as string
        setStore("chainId", parseInt(chainId, 16))
      } catch (err) {
        const error = err as Error
        setStore("error", error.message || "Failed to connect wallet")
      } finally {
        setStore("isConnecting", false)
      }
    }

    const disconnect = () => {
      setStore("address", null)
      setStore("chainId", null)
      setStore("isConnected", false)
      setStore("error", null)
    }

    const switchChain = async (chainId: SupportedChainId) => {
      if (!window.ethereum) {
        setStore("error", "No wallet found")
        return
      }

      const hexChainId = `0x${chainId.toString(16)}`

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hexChainId }],
        })
      } catch (err) {
        const error = err as { code: number; message: string }

        // Chain not added, try to add it
        if (error.code === 4902) {
          const chain = SUPPORTED_CHAINS[chainId]
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hexChainId,
                  chainName: chain.name,
                  nativeCurrency: {
                    name: chain.symbol,
                    symbol: chain.symbol,
                    decimals: 18,
                  },
                  rpcUrls: [chain.rpcUrl],
                  blockExplorerUrls: [chain.blockExplorer],
                },
              ],
            })
          } catch {
            setStore("error", `Failed to add ${chain.name}`)
          }
        } else {
          setStore("error", error.message || "Failed to switch chain")
        }
      }
    }

    const getChainInfo = createMemo(() => {
      if (!store.chainId) return null
      return SUPPORTED_CHAINS[store.chainId as SupportedChainId] || null
    })

    const isSupportedChain = createMemo(() => {
      return store.chainId !== null && store.chainId in SUPPORTED_CHAINS
    })

    const formatAddress = (address: string | null) => {
      if (!address) return ""
      return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    return {
      // State accessors
      address: () => store.address,
      chainId: () => store.chainId,
      isConnected: () => store.isConnected,
      isConnecting: () => store.isConnecting,
      error: () => store.error,
      hasProvider,

      // Actions
      connect,
      disconnect,
      switchChain,

      // Helpers
      getChainInfo,
      isSupportedChain,
      formatAddress,

      // Constants
      supportedChains: SUPPORTED_CHAINS,
    }
  },
})
