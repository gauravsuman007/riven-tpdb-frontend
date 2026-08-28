<script lang="ts">
    import { cn } from "$lib/utils";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import type { HTMLAttributes } from "svelte/elements";
    import { afterNavigate, goto } from "$app/navigation";
    import { page } from "$app/state";
    import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";

    interface PageShellProps extends HTMLAttributes<HTMLElement> {
        /**
         * Force the back button on or off. Left unset it appears on every
         * page except the home page, which has nowhere to go back to.
         */
        back?: boolean;
        /**
         * Where to go when there is no in-app history to return to -- a deep
         * link, a fresh tab, or the first page after a reload.
         */
        fallback?: string;
    }

    let {
        class: className,
        children,
        back,
        fallback = "/",
        ...restProps
    }: PageShellProps = $props();

    /**
     * Whether we arrived here from another page of this app.
     *
     * `history.back()` is only correct when the previous entry is ours. On a
     * deep link (a shared URL, a bookmark, the Jellyfin shell's first load)
     * the previous entry belongs to whatever came before the app, or does not
     * exist at all, and going back would leave the app entirely -- not what a
     * back button inside a page should do. `navigation.from` is null in
     * exactly those cases, which makes it the right signal; `history.length`
     * is not, because it counts entries from other origins too.
     */
    let cameFromApp = $state(false);

    afterNavigate((navigation) => {
        cameFromApp = navigation.from !== null;
    });

    const showBack = $derived(back ?? page.url.pathname !== "/");

    function goBack() {
        if (cameFromApp) {
            history.back();
            return;
        }

        goto(fallback);
    }
</script>

<main
    in:fly|global={{ y: 20, duration: 600, easing: cubicOut }}
    class={cn("mt-4 flex flex-col gap-6 p-4 pb-24 md:mt-14 md:gap-8 md:p-8 md:px-16", className)}
    {...restProps}>
    {#if showBack}
        <!--
            Above the page's own heading rather than inside it: every page
            builds its header differently, and this has to land in the same
            place on all of them to be findable.
        -->
        <button
            type="button"
            onclick={goBack}
            class="text-muted-foreground hover:text-foreground hover:bg-muted/60 -mb-2 -ml-2 flex w-fit items-center gap-1 rounded-lg py-1.5 pr-3 pl-1.5 text-sm transition-colors md:-mb-4"
            aria-label="Go back">
            <ChevronLeftIcon class="size-4" />
            Back
        </button>
    {/if}

    {@render children?.()}
</main>
