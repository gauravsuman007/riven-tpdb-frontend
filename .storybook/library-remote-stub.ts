// SvelteKit's `command()` remote functions (`$app/server`) are transformed into
// client-callable RPC stubs by SvelteKit's own route-manifest-driven build step.
// Storybook imports `+page.svelte` files directly, bypassing that routing/build
// pipeline entirely, so `.remote.ts` files are left un-transformed and their
// named exports go missing in `storybook build`'s production bundle (this does
// NOT surface in `vitest --project=storybook`, which uses the dev module graph).
// This stub stands in for library.remote.ts so the library page's story can be
// bundled; none of the real actions fire in Storybook regardless.
export async function reset_items(_args: { ids: string[] }) {
    return { success: true, count: 0 };
}

export async function retry_items(_args: { ids: string[] }) {
    return { success: true, count: 0 };
}

export async function remove_items(_args: { ids: string[] }) {
    return { success: true, count: 0 };
}
