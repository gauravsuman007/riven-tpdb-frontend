<script lang="ts">
    import { ModeWatcher } from "mode-watcher";
    import type { Snippet } from "svelte";

    // Optional so `() => ({ Component: ThemeDecorator })` type-checks when used
    // directly in a story's `decorators` array — Storybook's DecoratorHandler
    // always supplies children via normal slotting at runtime regardless.
    let { children }: { children?: Snippet } = $props();
</script>

<ModeWatcher defaultMode="dark" defaultTheme="darkmatter" />
{@render children?.()}
