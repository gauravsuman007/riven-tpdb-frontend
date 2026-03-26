<script lang="ts">
    import { gqlClient } from "$lib/graphql-client";
    import { toast } from "svelte-sonner";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import SeasonSelector, { type SeasonInfo } from "./season-selector.svelte";
    import { createScopedLogger } from "$lib/logger";
    import { type Snippet } from "svelte";
    import { SvelteSet } from "svelte/reactivity";

    const logger = createScopedLogger("item-request");

    interface Props {
        title: string | null | undefined;
        ids: (string | null | undefined)[];
        mediaType: string; //"movie" | "tv"
        seasons?: SeasonInfo[];
        buttonLabel?: string;
        externalId?: string; // TVDB or TMDB ID for scraping
        variant?:
            | "ghost"
            | "default"
            | "link"
            | "destructive"
            | "outline"
            | "secondary"
            | undefined;
        size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | undefined;
        class?: string;
        children?: Snippet;
    }
    let {
        title,
        ids,
        mediaType,
        seasons = [],
        buttonLabel = "Request",
        externalId,
        variant = "ghost",
        size = "sm",
        class: className = "",
        children,
        ...restProps
    }: Props = $props();

    let open = $state(false);
    let loading = $state(false);

    // State for season selection - managed by SeasonSelector component
    let selectedSeasons = $state<SvelteSet<number>>(new SvelteSet());

    const sortedSelectedSeasonNumbers = $derived.by(() =>
        Array.from(selectedSeasons)
            .filter((n) => Number.isInteger(n))
            .sort((a, b) => a - b)
    );

    const requestableSeasons = $derived.by(() =>
        seasons
            .filter((s) => s.status !== "Available")
            .map((s) => s.season_number)
            .filter((n) => Number.isInteger(n))
            .sort((a, b) => a - b)
    );

    const hasRequestableSeasons = $derived(requestableSeasons.length > 0);

    async function addMediaItem(ids: (string | null | undefined)[], mediaType: string) {
        const validNumericIds = ids
            .filter((id): id is string => id !== null && id !== undefined)
            .map(Number)
            .filter((n) => !isNaN(n));

        try {
            if (mediaType === "tv") {
                // Shows: always use addItem so seasons are properly tracked.
                // The backend handles idempotency — if the show exists it merges seasons.
                const itemTitle = title ?? "Unknown";
                const selectedSeasonNumbers =
                    sortedSelectedSeasonNumbers.length > 0 ? sortedSelectedSeasonNumbers : null;

                await gqlClient<{ addItem: { id: number } }>(
                    `mutation AddItem($itemType: MediaItemType!, $title: String!, $tvdbId: String, $seasons: [Int!]) {
                        addItem(itemType: $itemType, title: $title, tvdbId: $tvdbId, seasons: $seasons) { id }
                    }`,
                    {
                        itemType: "SHOW",
                        title: itemTitle,
                        tvdbId: externalId,
                        seasons: selectedSeasonNumbers
                    }
                );
                toast.success("Requested successfully!");
                open = false;
            } else if (validNumericIds.length > 0) {
                // Movie already exists — retry to re-queue
                await gqlClient<{ retryItems: number }>(
                    `mutation RetryItems($ids: [Int!]!) { retryItems(ids: $ids) }`,
                    { ids: validNumericIds }
                );
                toast.success("Request queued successfully!");
                open = false;
            } else {
                // Movie not yet in Riven — add it fresh
                const itemTitle = title ?? "Unknown";
                await gqlClient<{ addItem: { id: number } }>(
                    `mutation AddItem($itemType: MediaItemType!, $title: String!, $tmdbId: String) {
                        addItem(itemType: $itemType, title: $title, tmdbId: $tmdbId) { id }
                    }`,
                    { itemType: "MOVIE", title: itemTitle, tmdbId: externalId }
                );
                toast.success("Requested successfully!");
                open = false;
            }
        } catch (e) {
            logger.error("Request failed", e);
            toast.error("Failed to request media item.");
        }
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            <Button {variant} {size} class={className} {...restProps} {...props}>
                {#if children}
                    {@render children()}
                {:else}
                    {buttonLabel}
                {/if}
            </Button>
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>
                Requesting "{title ?? "Media Item"}"
            </AlertDialog.Title>
            <AlertDialog.Description>
                This will send a request to Riven to add this media.
            </AlertDialog.Description>
        </AlertDialog.Header>

        {#if mediaType === "tv" && seasons.length > 0}
            <SeasonSelector {seasons} {open} bind:selectedSeasons class="my-4" />
        {:else}
            <div class="text-muted-foreground py-4 text-sm">
                This request will be approved automatically.
            </div>
        {/if}

        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                disabled={loading ||
                    (mediaType === "tv" &&
                        seasons.length > 0 &&
                        hasRequestableSeasons &&
                        sortedSelectedSeasonNumbers.length === 0)}
                onclick={async () => {
                    loading = true;
                    await addMediaItem(ids, mediaType);
                    loading = false;
                    open = false;
                }}>
                {#if loading}
                    <Loader2 class="mr-1 inline-block animate-spin" />
                {/if}
                {mediaType === "tv" && seasons.length > 0 ? "Request Selected" : "Request"}
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
