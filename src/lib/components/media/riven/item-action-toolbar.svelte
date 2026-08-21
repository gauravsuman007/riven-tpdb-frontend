<script lang="ts">
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import Play from "@lucide/svelte/icons/play";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import RefreshCw from "@lucide/svelte/icons/refresh-cw";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import Search from "@lucide/svelte/icons/search";
    import Pause from "@lucide/svelte/icons/pause";
    import Download from "@lucide/svelte/icons/download";
    import ItemRequest from "./item-request.svelte";
    import ItemAction from "./item-action.svelte";
    import ItemManualScrape from "./item-manual-scrape.svelte";
    import RawDataDialog from "./raw-data-dialog.svelte";
    import type { SeasonInfo } from "./season-selector.svelte";
    import type { RivenMediaItem } from "$lib/types/riven";

    interface Props {
        title: string | null | undefined;
        mediaType: "movie" | "tv" | undefined;
        externalId: string | null | undefined;
        seasons: SeasonInfo[];
        riven: RivenMediaItem | undefined;
        rivenId: number | string | null | undefined;
        rivenPending: boolean;
        onRequestSuccess: (itemId?: number) => void | Promise<void>;
        onActionSuccess: () => void | Promise<void>;
        rawDataOpen: boolean;
        rawRivenLoading: boolean;
        rawRivenError: string | undefined;
        rawRivenJson: string | undefined;
    }

    let {
        title,
        mediaType,
        externalId,
        seasons,
        riven,
        rivenId,
        rivenPending,
        onRequestSuccess,
        onActionSuccess,
        rawDataOpen = $bindable(false),
        rawRivenLoading,
        rawRivenError,
        rawRivenJson
    }: Props = $props();

    const rivenIds = $derived(rivenId ? [rivenId.toString()] : []);
</script>

<div
    class="flex flex-wrap items-center gap-2"
    in:fly|global={{ y: 20, duration: 400, delay: 150, easing: cubicOut }}>
    {#if mediaType && externalId != null && !riven && !rivenPending}
        <ItemRequest
            size="default"
            variant="secondary"
            class="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary border bg-transparent px-4"
            {title}
            ids={[]}
            {mediaType}
            externalId={externalId ?? ""}
            {seasons}
            onSuccess={onRequestSuccess}>
            <Download class="mr-1.5 h-4 w-4" />
            Request
        </ItemRequest>
        <ItemManualScrape
            size="default"
            variant="secondary"
            class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
            {title}
            itemId={null}
            externalId={externalId ?? ""}
            mediaType={mediaType ?? "movie"}
            {seasons}>
            <Search class="mr-1.5 h-4 w-4" />
            Manual Scrape
        </ItemManualScrape>
    {/if}
    {#if riven?.id != null}
        <ItemAction
            kind="reset"
            size="default"
            variant="secondary"
            class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
            {title}
            ids={rivenIds}
            onSuccess={onActionSuccess}>
            <RotateCcw class="mr-1.5 h-4 w-4" />
            Reset
        </ItemAction>
        <ItemAction
            kind="retry"
            size="default"
            variant="secondary"
            class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
            {title}
            ids={rivenIds}
            onSuccess={onActionSuccess}>
            <RefreshCw class="mr-1.5 h-4 w-4" />
            Retry
        </ItemAction>

        {#if mediaType === "tv"}
            <ItemRequest
                size="default"
                variant="secondary"
                class="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary hover:border-primary border bg-transparent px-4"
                {title}
                ids={rivenIds}
                {mediaType}
                externalId={externalId ?? ""}
                {seasons}
                onSuccess={onRequestSuccess}>
                <Download class="mr-1.5 h-4 w-4" />
                Request More
            </ItemRequest>
        {/if}

        <ItemManualScrape
            size="default"
            variant="secondary"
            class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
            {title}
            itemId={rivenId?.toString() ?? null}
            externalId={externalId ?? ""}
            mediaType={mediaType ?? "movie"}
            {seasons}>
            <Search class="mr-1.5 h-4 w-4" />
            Manual Scrape
        </ItemManualScrape>

        {#if riven.state !== "Completed"}
            <ItemAction
                kind="pause"
                size="default"
                variant="secondary"
                class="border-border text-muted-foreground hover:bg-muted hover:text-foreground border bg-transparent px-4"
                {title}
                isPaused={riven.state === "Paused"}
                ids={rivenIds}>
                {#if riven.state === "Paused"}
                    <Play class="mr-1.5 h-4 w-4" /> Resume
                {:else}
                    <Pause class="mr-1.5 h-4 w-4" /> Pause
                {/if}
            </ItemAction>
        {/if}

        <ItemAction
            kind="delete"
            size="default"
            variant="secondary"
            class="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive border bg-transparent px-4"
            {title}
            ids={rivenIds}>
            <Trash2 class="mr-1.5 h-4 w-4" />
            Delete
        </ItemAction>

        <RawDataDialog
            bind:open={rawDataOpen}
            loading={rawRivenLoading}
            error={rawRivenError}
            json={rawRivenJson} />
    {/if}
</div>
