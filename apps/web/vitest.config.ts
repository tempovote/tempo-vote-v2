import { defineConfig } from "vitest/config"
import { resolve } from "node:path"

// Unit tests for pure logic in apps/web (lib helpers, routing matrices).
// Node environment — no DOM/React rendering needed for these. The "@/..." alias
// mirrors tsconfig.json paths so test imports match app imports.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
