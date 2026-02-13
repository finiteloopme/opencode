/**
 * Auth Context for Google authentication via IAP
 *
 * In production (Cloud Run with IAP), reads user from IAP headers.
 * In local development, uses gcloud CLI account.
 *
 * Sign-out behavior:
 * - In production: redirects to login page (LOGIN_PAGE_URL)
 * - In local dev: clears local state only (gcloud auth remains)
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

interface AppConfigResponse {
  loginPageUrl: string | null
}

export interface AuthState {
  email: string | null
  source: "iap" | "gcloud" | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginPageUrl: string | null
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
      loginPageUrl: null,
    })

    // Fetch current user and app config on mount
    createEffect(() => {
      fetchUser()
      fetchAppConfig()
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

    const fetchAppConfig = async () => {
      try {
        const response = await fetch(`${server.url}/global/app-config`, {
          credentials: "include",
        })

        if (response.ok) {
          const data: AppConfigResponse = await response.json()
          setStore("loginPageUrl", data.loginPageUrl)
        }
      } catch (err) {
        // Non-critical - just log and continue
        console.warn("Failed to fetch app config:", err)
      }
    }

    const signOut = () => {
      // Clear local state
      setStore("email", null)
      setStore("source", null)
      setStore("isAuthenticated", false)

      // Redirect to login page if configured (production)
      // In local dev, loginPageUrl is null - just stay on app
      const loginUrl = store.loginPageUrl
      if (loginUrl) {
        window.location.href = loginUrl
      }
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
      loginPageUrl: () => store.loginPageUrl,

      // Actions
      refresh: fetchUser,
      signOut,

      // Helpers
      formatEmail,
    }
  },
})
