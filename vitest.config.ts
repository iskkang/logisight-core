import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "node",
      include: ["src/**/__tests__/**/*.test.ts", "src/components/**/*.test.tsx"],
      passWithNoTests: true,
      environmentMatchGlobs: [
        ["src/components/**/*.test.tsx", "jsdom"],
      ],
    },
  }),
);
