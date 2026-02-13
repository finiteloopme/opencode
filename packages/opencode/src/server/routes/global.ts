import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamSSE } from "hono/streaming"
import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Instance } from "../../project/instance"
import { Installation } from "@/installation"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"
import { Config } from "../../config/config"
import { errors } from "../error"
import { spawn } from "child_process"

const log = Log.create({ service: "server" })

/**
 * Get current user email from gcloud CLI
 */
async function getGcloudAccount(): Promise<string | null> {
  return new Promise((resolve) => {
    const proc = spawn("gcloud", ["config", "get", "account"], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    proc.stdout.on("data", (data) => {
      stdout += data.toString()
    })

    proc.on("close", (code) => {
      if (code === 0) {
        const email = stdout.trim()
        if (email && email.includes("@")) {
          resolve(email)
          return
        }
      }
      resolve(null)
    })

    proc.on("error", () => {
      resolve(null)
    })

    // Timeout after 2 seconds
    setTimeout(() => {
      proc.kill()
      resolve(null)
    }, 2000)
  })
}

export const GlobalDisposedEvent = BusEvent.define("global.disposed", z.object({}))

export const GlobalRoutes = lazy(() =>
  new Hono()
    .get(
      "/health",
      describeRoute({
        summary: "Get health",
        description: "Get health information about the OpenCode server.",
        operationId: "global.health",
        responses: {
          200: {
            description: "Health information",
            content: {
              "application/json": {
                schema: resolver(z.object({ healthy: z.literal(true), version: z.string() })),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({ healthy: true, version: Installation.VERSION })
      },
    )
    .get(
      "/event",
      describeRoute({
        summary: "Get global events",
        description: "Subscribe to global events from the OpenCode system using server-sent events.",
        operationId: "global.event",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  z
                    .object({
                      directory: z.string(),
                      payload: BusEvent.payloads(),
                    })
                    .meta({
                      ref: "GlobalEvent",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("global event connected")
        return streamSSE(c, async (stream) => {
          stream.writeSSE({
            data: JSON.stringify({
              payload: {
                type: "server.connected",
                properties: {},
              },
            }),
          })
          async function handler(event: any) {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          }
          GlobalBus.on("event", handler)

          // Send heartbeat every 30s to prevent WKWebView timeout (60s default)
          const heartbeat = setInterval(() => {
            stream.writeSSE({
              data: JSON.stringify({
                payload: {
                  type: "server.heartbeat",
                  properties: {},
                },
              }),
            })
          }, 30000)

          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              clearInterval(heartbeat)
              GlobalBus.off("event", handler)
              resolve()
              log.info("global event disconnected")
            })
          })
        })
      },
    )
    .get(
      "/config",
      describeRoute({
        summary: "Get global configuration",
        description: "Retrieve the current global OpenCode configuration settings and preferences.",
        operationId: "global.config.get",
        responses: {
          200: {
            description: "Get global config info",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Config.getGlobal())
      },
    )
    .patch(
      "/config",
      describeRoute({
        summary: "Update global configuration",
        description: "Update global OpenCode configuration settings and preferences.",
        operationId: "global.config.update",
        responses: {
          200: {
            description: "Successfully updated global config",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", Config.Info),
      async (c) => {
        const config = c.req.valid("json")
        const next = await Config.updateGlobal(config)
        return c.json(next)
      },
    )
    .post(
      "/dispose",
      describeRoute({
        summary: "Dispose instance",
        description: "Clean up and dispose all OpenCode instances, releasing all resources.",
        operationId: "global.dispose",
        responses: {
          200: {
            description: "Global disposed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await Instance.disposeAll()
        GlobalBus.emit("event", {
          directory: "global",
          payload: {
            type: GlobalDisposedEvent.type,
            properties: {},
          },
        })
        return c.json(true)
      },
    )
    .get(
      "/app-config",
      describeRoute({
        summary: "Get application configuration",
        description: "Get application-level configuration including login page URL for sign-out redirect.",
        operationId: "global.appConfig",
        responses: {
          200: {
            description: "Application configuration",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    loginPageUrl: z.string().nullable(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({
          loginPageUrl: process.env.LOGIN_PAGE_URL || null,
        })
      },
    )
    .get(
      "/me",
      describeRoute({
        summary: "Get current user",
        description:
          "Get the currently authenticated user. In production (Cloud Run with IAP), reads from IAP headers. In local development, uses gcloud CLI account.",
        operationId: "global.me",
        responses: {
          200: {
            description: "Current user information",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    authenticated: z.boolean(),
                    source: z.enum(["iap", "gcloud"]).optional(),
                    email: z.string().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        // Check for IAP headers (production - Cloud Run with IAP enabled)
        const iapEmail = c.req.header("X-Goog-Authenticated-User-Email")

        if (iapEmail) {
          // IAP header format: "accounts.google.com:email@example.com"
          const email = iapEmail.replace("accounts.google.com:", "")
          return c.json({
            authenticated: true,
            source: "iap" as const,
            email,
          })
        }

        // Local development: get account from gcloud CLI
        const gcloudEmail = await getGcloudAccount()
        if (gcloudEmail) {
          return c.json({
            authenticated: true,
            source: "gcloud" as const,
            email: gcloudEmail,
          })
        }

        // No authentication available
        return c.json({ authenticated: false })
      },
    ),
)
