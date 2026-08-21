// `@storybook/sveltekit` mocks `$app/*` but not `$env/*`. SvelteKit's real
// `$env/dynamic/public` virtual module needs a running dev-server request
// context that Storybook's Vite server doesn't provide, so anything that
// imports it at module scope (e.g. `$lib/logger.ts`) crashes on load. This
// stub stands in for it — see the `resolve.alias` wiring in `main.ts`.
export const env: Record<string, string | undefined> = {};
