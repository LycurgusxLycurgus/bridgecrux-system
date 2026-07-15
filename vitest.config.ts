import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "conformance/test/**/*.test.ts"],
    exclude: ["**/*.live.test.ts"],
    testTimeout: 30_000,
  },
});
