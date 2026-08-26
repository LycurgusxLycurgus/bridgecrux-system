import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "conformance/test/**/*.test.ts"],
    exclude: ["**/*.live.test.ts"],
    // The packed-consumer test runs npm pack, whose skills prepack hook
    // refreshes the repository-local bundled-skills tree. Keep test files
    // serial so installer tests never read that shared tree mid-refresh.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
