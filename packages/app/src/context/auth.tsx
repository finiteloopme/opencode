/**
 * Auth Context for Google authentication via IAP
 *
 * In production (Cloud Run with IAP), reads user from IAP headers.
 * In local development, uses gcloud CLI account.
 */

import { createEffect } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@opencode-ai/ui/context"
import { useServer } from "./server"

interface MeResponse {
  authenticated: boolean
  source?: "iap" | "gcloud"
  email?: string
}

export interface AuthState {
  email: string | null
  source: "iap" | "gcloud" | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export const { use: useAuth, provider: AuthProvider } = createSimpleContext({
  name: "Auth",
  gate: false, // Don't gate on ready - auth check happens in background
  init: () => {
    const server = useServer()

    const [store, setStore] = createStore<AuthState>({
      email: null,
      source: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    })

    // Fetch current user on mount
    createEffect(() => {
      fetchUser()
    })

    const fetchUser = async () => {
      setStore("isLoading", true)
      setStore("error", null)

      try {
        const response = await fetch(`${server.url}/global/me`, {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data: MeResponse = await response.json()

        if (data.authenticated && data.email) {
          setStore("email", data.email)
          setStore("source", data.source ?? null)
          setStore("isAuthenticated", true)
        } else {
          setStore("email", null)
          setStore("source", null)
          setStore("isAuthenticated", false)
        }
      } catch (err) {
        const error = err as Error
        console.error("Failed to fetch user:", error)
        setStore("error", error.message || "Failed to fetch user")
        setStore("isAuthenticated", false)
      } finally {
        setStore("isLoading", false)
      }
    }

    const signOut = () => {
      // Clear local state only - don't sign out of Google
      setStore("email", null)
      setStore("source", null)
      setStore("isAuthenticated", false)
    }

    const formatEmail = (email: string | null) => {
      if (!email) return ""
      if (email.length <= 16) return email
      const [local, domain] = email.split("@")
      if (!domain) return email
      const truncatedLocal = local.length > 8 ? `${local.slice(0, 8)}...` : local
      return `${truncatedLocal}@${domain}`
    }

    return {
      // State accessors
      email: () => store.email,
      source: () => store.source,
      isAuthenticated: () => store.isAuthenticated,
      isLoading: () => store.isLoading,
      error: () => store.error,

      // Actions
      refresh: fetchUser,
      signOut,

      // Helpers
      formatEmail,
    }
  },
})
