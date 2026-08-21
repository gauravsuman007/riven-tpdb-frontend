import "../src/app.css";
import "@fontsource/oxanium/400.css";
import "@fontsource/oxanium/700.css";
import "@fontsource/jetbrains-mono/latin.css";
import "@fontsource/merriweather/latin.css";

import type { Preview } from "@storybook/sveltekit";
import { mswLoader } from "msw-storybook-addon/csf3";

import ThemeDecorator from "./decorators/ThemeDecorator.svelte";

// `sveltekit-superforms` detects Storybook via `globalThis.STORIES` to disable
// its navigation-store integration. Storybook's real preview iframe sets this
// automatically, but the addon-vitest headless test runner does not — set it
// explicitly so `superForm()` behaves consistently in both.
(globalThis as { STORIES?: boolean }).STORIES = true;

const preview: Preview = {
    decorators: [() => ({ Component: ThemeDecorator })],
    loaders: [mswLoader()],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i
            }
        },

        a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: "todo"
        }
    }
};

export default preview;
