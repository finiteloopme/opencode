import { defineConfig } from "vite"
import desktopPlugin from "./vite"
import toml from "toml"
import fs from "fs"

// Load config.toml and inject as __CONFIG__ for runtime access
const configToml = toml.parse(fs.readFileSync("./config.toml", "utf-8"))

export default defineConfig({
  plugins: [desktopPlugin] as any,
  define: {
    __CONFIG__: JSON.stringify(configToml),
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
})
