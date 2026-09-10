<!--
    Explore: one section, three ways in.

    Recommendations, the AVN award corpus and the Adult Empire brochure were
    three separate navbar entries, which made them read as three unrelated
    features. They are not: each is a different source of the same answer to
    the same question -- what should I watch that I do not already own. One
    entry, tabs inside.

    The tab strip lives in the layout rather than in each page so it does not
    move by a pixel between tabs; a strip that shifts is what makes tabbed
    navigation feel like a page reload.
-->
<script lang="ts">
    import { page } from "$app/state";
    import { resolve } from "$app/paths";
    import SparklesIcon from "@lucide/svelte/icons/sparkles";
    import TrophyIcon from "@lucide/svelte/icons/trophy";
    import BookOpenIcon from "@lucide/svelte/icons/book-open";

    let { children } = $props();

    const tabs = [
        { href: "/explore", label: "For you", icon: SparklesIcon },
        { href: "/explore/awards", label: "AVN winners", icon: TrophyIcon },
        { href: "/explore/brochure", label: "Adult Empire", icon: BookOpenIcon }
    ] as const;

    /*
        Exact match for the hub, prefix for the children. "/explore" is a
        prefix of every tab's path, so a prefix test there would light all
        three at once.
    */
    const hub = $derived(resolve("/explore"));

    function isActive(target: string): boolean {
        if (target === hub) {
            return page.url.pathname === target;
        }

        return page.url.pathname === target || page.url.pathname.startsWith(`${target}/`);
    }
</script>

<div class="mx-auto w-full max-w-[2400px] px-4 pt-24 md:px-16 md:pt-14">
    <nav
        class="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md"
        aria-label="Explore sections">
        {#each tabs as tab (tab.href)}
            {@const target = resolve(tab.href)}
            <a
                href={target}
                class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors
                {isActive(target)
                    ? 'bg-white/15 text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/10'}"
                aria-current={isActive(target) ? "page" : undefined}>
                <tab.icon class="size-4" aria-hidden="true" />
                <span>{tab.label}</span>
            </a>
        {/each}
    </nav>
</div>

{@render children?.()}
