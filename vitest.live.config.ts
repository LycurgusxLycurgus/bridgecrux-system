import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["conformance/test/**/*.live.test.ts"],
    testTimeout: 120_000,
  },
});
