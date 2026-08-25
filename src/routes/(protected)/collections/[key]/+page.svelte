<!--
    One collection, grouped by award category.

    Entries are not library items and are not styled as though they were. Each
    row says which of three states it is in, because they are genuinely
    different things:

      * in library  - requested, has a MediaItem, is being acquired
      * matched     - resolved to a TPDB title, one click from being requested
      * unmatched   - the award is real but nothing in TPDB corresponds to it,
                      kept visible as a known gap rather than hidden
-->
<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import { groupByCategory } from "$lib/collections";
    import Trophy from "@lucide/svelte/icons/trophy";
    import Plus from "@lucide/svelte/icons/plus";
    import Check from "@lucide/svelte/icons/check";
    import CircleSlash from "@lucide/svelte/icons/circle-slash";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import Bookmark from "@lucide/svelte/icons/bookmark";
    import Trash2 from "@lucide/svelte/icons/trash-2";
    import X from "@lucide/svelte/icons/x";

    let { data }: PageProps = $props();

    const grouped = $derived(groupByCategory(data.collection.entries));

    // A user collection is editable; a source-built catalogue is rebuilt on
    // every sync, so offering to edit one would be a lie.
    const editable = $derived(data.collection.source === "user");

    // With nominees switched off every entry is a winner, which makes both the
    // "winners only" filter and the per-row trophy pure noise.
    const allWinners = $derived(data.collection.winners === data.collection.total);

    /** Entry ids with a request in flight, so each row can spin independently. */
    let pending = $state(new Set<number>());

    function toggleFilter(name: "winners" | "matched") {
        const url = new URL(page.url);

        if (url.searchParams.get(name) === "1") {
            url.searchParams.delete(name);
        } else {
            url.searchParams.set(name, "1");
        }

        goto(url, { keepFocus: true, noScroll: true });
    }
</script>

<svelte:head>
    <title>{data.collection.name} · Riven</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-8">
        <header class="flex flex-col justify-between gap-6 pt-32 md:flex-row md:items-end md:pt-0">
            <div class="space-y-2">
                <div class="flex items-center gap-3">
                    {#if editable}
                        <Bookmark class="text-primary h-7 w-7" aria-hidden="true" />
                    {:else}
                        <Trophy class="text-primary h-7 w-7" aria-hidden="true" />
                    {/if}
                    <h1
                        class="font-serif text-4xl font-medium tracking-tight text-white/90 md:text-6xl">
                        {data.collection.name}
                    </h1>
                </div>

                {#if data.collection.description}
                    <p class="max-w-2xl text-sm text-zinc-300">{data.collection.description}</p>
                {/if}

                <div class="flex flex-wrap items-center gap-2 text-zinc-300">
                    <span class="font-mono text-xs tracking-widest uppercase">
                        {data.collection.source}
                    </span>
                    <span class="h-px w-8 bg-zinc-700"></span>
                    <span class="font-mono text-sm">
                        {data.collection.requested.toLocaleString()} in library ·
                        {data.collection.matched.toLocaleString()} matched ·
                        {data.collection.total.toLocaleString()}
                        {allWinners ? "winners" : "entries"}
                    </span>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                {#if !allWinners}
                    <Button
                        variant={data.winnersOnly ? "default" : "outline"}
                        onclick={() => toggleFilter("winners")}>
                        Winners only
                    </Button>
                {/if}
                <Button
                    variant={data.matchedOnly ? "default" : "outline"}
                    onclick={() => toggleFilter("matched")}>
                    Matched only
                </Button>

                {#if editable}
                    <form method="POST" action="?/destroy" use:enhance>
                        <Button type="submit" variant="outline">
                            <Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />
                            Delete collection
                        </Button>
                    </form>
                {/if}
            </div>
        </header>

        {#if !grouped.length}
            <p class="py-16 text-center text-zinc-300">
                Nothing here yet. Entries appear once the award corpus has been synced.
            </p>
        {:else}
            <div class="flex flex-col gap-10 pb-16">
                {#each grouped as [category, entries] (category)}
                    <section class="flex flex-col gap-3">
                        <h2
                            class="border-b border-white/15 pb-2 font-mono text-xs tracking-widest text-zinc-300 uppercase">
                            {category}
                        </h2>

                        <ul class="flex flex-col gap-1">
                            {#each entries as entry (entry.id)}
                                <li
                                    class="flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-white/15 hover:bg-white/5">
                                    {#if entry.winner}
                                        <Trophy
                                            class="text-primary h-4 w-4 shrink-0"
                                            aria-label="Winner" />
                                    {:else}
                                        <span class="h-4 w-4 shrink-0" aria-label="Nominee"></span>
                                    {/if}

                                    <div class="min-w-0 flex-1">
                                        <p class="truncate text-white/90">{entry.title}</p>
                                        {#if entry.studio || entry.performers?.length}
                                            <p class="truncate font-mono text-xs text-zinc-400">
                                                {[entry.studio, entry.performers?.join(", ")]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </p>
                                        {/if}
                                    </div>

                                    {#if entry.requested}
                                        <span
                                            class="flex items-center gap-1.5 font-mono text-xs text-emerald-300">
                                            <Check class="h-3.5 w-3.5" aria-hidden="true" />
                                            {entry.state ?? "In library"}
                                        </span>
                                    {:else if entry.actionable}
                                        <form
                                            method="POST"
                                            action="?/request"
                                            use:enhance={() => {
                                                pending = new Set(pending).add(entry.id);

                                                return async ({ result, update }) => {
                                                    const next = new Set(pending);
                                                    next.delete(entry.id);
                                                    pending = next;

                                                    if (result.type === "failure") {
                                                        toast.error(
                                                            String(
                                                                result.data?.message ??
                                                                    "Request failed"
                                                            )
                                                        );
                                                    } else if (result.type === "success") {
                                                        toast.success(
                                                            String(
                                                                result.data?.message ?? "Requested"
                                                            )
                                                        );
                                                    }

                                                    await update({ reset: false });
                                                };
                                            }}>
                                            <input type="hidden" name="entryId" value={entry.id} />
                                            <Button
                                                type="submit"
                                                size="sm"
                                                variant="outline"
                                                disabled={pending.has(entry.id)}>
                                                {#if pending.has(entry.id)}
                                                    <Loader2
                                                        class="h-3.5 w-3.5 animate-spin"
                                                        aria-hidden="true" />
                                                {:else}
                                                    <Plus class="h-3.5 w-3.5" aria-hidden="true" />
                                                {/if}
                                                Request
                                            </Button>
                                        </form>
                                    {:else if entry.match_state === "pending"}
                                        <span class="font-mono text-xs text-zinc-400">
                                            Not yet looked up
                                        </span>
                                    {:else}
                                        <span
                                            class="flex items-center gap-1.5 font-mono text-xs text-zinc-400"
                                            title="This award is real, but no TPDB title matches it">
                                            <CircleSlash class="h-3.5 w-3.5" aria-hidden="true" />
                                            No TPDB match
                                        </span>
                                    {/if}

                                    {#if editable}
                                        <!--
                                            Removes the entry from this list
                                            only. A title already in the library
                                            stays there -- the collection never
                                            owned it.
                                        -->
                                        <form
                                            method="POST"
                                            action="?/remove"
                                            use:enhance={() => {
                                                return async ({ result, update }) => {
                                                    if (result.type === "failure") {
                                                        toast.error(
                                                            String(
                                                                result.data?.message ??
                                                                    "Could not remove"
                                                            )
                                                        );
                                                    }

                                                    await update({ reset: false });
                                                };
                                            }}>
                                            <input type="hidden" name="entryId" value={entry.id} />
                                            <Button
                                                type="submit"
                                                size="icon"
                                                variant="ghost"
                                                title="Remove from this collection"
                                                aria-label={`Remove ${entry.title} from this collection`}>
                                                <X class="h-3.5 w-3.5" aria-hidden="true" />
                                            </Button>
                                        </form>
                                    {/if}
                                </li>
                            {/each}
                        </ul>
                    </section>
                {/each}
            </div>
        {/if}
    </div>
</PageShell>
