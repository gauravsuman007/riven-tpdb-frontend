import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, mergeConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

import { playwright } from "@vitest/browser-playwright";

import viteConfig from "./vite.config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig(async (env) => {
    const resolvedViteConfig =
        typeof viteConfig === "function" ? await viteConfig(env) : viteConfig;

    return mergeConfig(
        resolvedViteConfig,
        defineConfig({
            test: {
                projects: [
                    {
                        extends: true,
                        plugins: [
                            // The plugin will run tests for the stories defined in your Storybook config
                            // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                            storybookTest({ configDir: path.join(dirname, ".storybook") })
                        ],
                        test: {
                            name: "storybook",
                            browser: {
                                enabled: true,
                                headless: true,
                                provider: playwright({}),
                                instances: [{ browser: "chromium" }]
                            }
                        }
                    }
                ]
            }
        })
    );
});
