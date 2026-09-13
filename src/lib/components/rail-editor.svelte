<!--
    Arranging a page's rows.

    A DRAWER, NOT A DRAG. Reordering by dragging is the obvious design and the
    wrong one here: these rows are arranged as often from a phone as from a
    desktop, a drag needs a pointer that can hover to discover it is even
    possible, and the same gesture on a touch screen fights the page's own
    scroll. Up/down buttons work with a finger, with a keyboard, and with a
    screen reader, and they say out loud what the drag only implies.

    THE PAGE DOES NOT MOVE WHILE YOU ARRANGE IT. Edits are held here and
    written on Save. Live reordering means every press re-fetches a row's
    items and the thing you were dragging jumps out from under you -- and a
    failed save would leave the screen showing an order the server does not
    have.

    WHAT IS OFFERED IS WHOSE PAGE IT IS. An add-on's own page offers only that
    add-on's rows; Home and Explore offer everything installed. That is the
    difference between "this add-on's screen" and "your screen", and it is
    passed in rather than decided here.
-->
<script lang="ts">
    import type { RailDef, RailPage, RailPlacement } from "$lib/rails";
    import { forEditing, resetRailLayout, saveRailLayout } from "$lib/rails";
    import { Button } from "$lib/components/ui/button/index.js";
    import ChevronUpIcon from "@lucide/svelte/icons/chevron-up";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import EyeOffIcon from "@lucide/svelte/icons/eye-off";
    import SlidersIcon from "@lucide/svelte/icons/sliders-horizontal";
    import XIcon from "@lucide/svelte/icons/x";

    interface Props {
        page: RailPage;
        catalogue: RailDef[];
        layout: RailPlacement[];
        /** Called with the saved layout, so the page can redraw itself. */
        onsaved?: (layout: RailPlacement[]) => void;
    }

    let { page, catalogue, layout, onsaved }: Props = $props();

    let open = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let draft = $state<RailPlacement[]>([]);

    const byKey = $derived(new Map(catalogue.map((rail) => [rail.key, rail])));

    function start() {
        // Taken fresh on every open, so a layout saved in another tab (or by
        // an add-on appearing since this page loaded) is what gets edited.
        draft = forEditing(catalogue, layout, page);
        error = null;
        open = true;
    }

    function move(index: number, by: number) {
        const target = index + by;
        if (target < 0 || target >= draft.length) return;

        const next = [...draft];
        [next[index], next[target]] = [next[target], next[index]];
        draft = next;
    }

    function toggle(index: number) {
        draft = draft.map((entry, at) =>
            at === index ? { ...entry, enabled: !entry.enabled } : entry
        );
    }

    /** Back to the app's own defaults, including rows added since. */
    async function reset() {
        saving = true;
        error = null;

        if (await resetRailLayout(page)) {
            onsaved?.([]);
            open = false;
        } else {
            error = "Could not reset the layout.";
        }

        saving = false;
    }

    async function save() {
        saving = true;
        error = null;

        if (await saveRailLayout(page, draft)) {
            onsaved?.(draft);
            open = false;
        } else {
            // The draft is kept. Closing on a failed save would discard an
            // arrangement somebody just made, to report that it was not kept.
            error = "Could not save the layout. Your changes are still here.";
        }

        saving = false;
    }
</script>

<Button size="sm" variant="secondary" onclick={start} class="rounded-full">
    <SlidersIcon class="mr-2 size-4" aria-hidden="true" />
    Edit rows
</Button>

{#if open}
    <!--
        A fixed panel rather than a modal dialog: the page behind it is the
        thing being arranged, and dimming it out makes the preview useless.
    -->
    <div
        class="border-border bg-background/95 fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-sm flex-col gap-3 border-l p-4 shadow-2xl backdrop-blur">
        <div class="flex items-center justify-between">
            <h2 class="text-base font-medium text-white/90">Rows on this page</h2>
            <Button
                size="icon"
                variant="ghost"
                class="rounded-full"
                aria-label="Close"
                onclick={() => (open = false)}>
                <XIcon class="size-4" aria-hidden="true" />
            </Button>
        </div>

        <p class="font-mono text-xs text-zinc-400">
            Rows are drawn top to bottom. Hidden rows keep their place, so turning one back on does
            not drop it at the bottom.
        </p>

        <ul class="flex flex-1 flex-col gap-1 overflow-y-auto">
            {#each draft as entry, index (entry.key)}
                {@const rail = byKey.get(entry.key)}
                <li
                    class="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5"
                    class:opacity-50={!entry.enabled}>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-sm text-white/90">{rail?.title ?? entry.key}</p>
                        <p class="truncate font-mono text-[10px] text-zinc-500">
                            {rail && rail.source !== "built-in"
                                ? rail.source
                                : "built-in"}{rail?.description ? ` · ${rail.description}` : ""}
                        </p>
                    </div>

                    <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full"
                        aria-label={entry.enabled
                            ? `Hide ${rail?.title ?? entry.key}`
                            : `Show ${rail?.title ?? entry.key}`}
                        onclick={() => toggle(index)}>
                        {#if entry.enabled}
                            <EyeIcon class="size-4" aria-hidden="true" />
                        {:else}
                            <EyeOffIcon class="size-4" aria-hidden="true" />
                        {/if}
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full"
                        disabled={index === 0}
                        aria-label={`Move ${rail?.title ?? entry.key} up`}
                        onclick={() => move(index, -1)}>
                        <ChevronUpIcon class="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        class="size-7 rounded-full"
                        disabled={index === draft.length - 1}
                        aria-label={`Move ${rail?.title ?? entry.key} down`}
                        onclick={() => move(index, 1)}>
                        <ChevronDownIcon class="size-4" aria-hidden="true" />
                    </Button>
                </li>
            {/each}

            {#if !draft.length}
                <li class="py-6 text-center font-mono text-xs text-zinc-500">
                    Nothing offers a row for this page yet.
                </li>
            {/if}
        </ul>

        {#if error}
            <p class="font-mono text-xs text-amber-400">{error}</p>
        {/if}

        <div class="flex items-center justify-between gap-2">
            <!--
                Not "turn everything off". An empty layout means "never
                arranged", so the page follows the app again and picks up rows
                added by later updates; every row switched off is a different
                state and stays that way. Without this there is no route from
                the second back to the first.
            -->
            <Button
                size="sm"
                variant="ghost"
                class="rounded-full text-xs"
                disabled={saving}
                onclick={reset}>
                Reset to default
            </Button>

            <div class="flex gap-2">
                <Button
                    size="sm"
                    variant="ghost"
                    class="rounded-full"
                    onclick={() => (open = false)}>
                    Cancel
                </Button>
                <Button size="sm" class="rounded-full" disabled={saving} onclick={save}>
                    {saving ? "Saving…" : "Save"}
                </Button>
            </div>
        </div>
    </div>
{/if}
