<script lang="ts">
    /**
     * Correct or withdraw a title's TPDB association, by hand.
     *
     * The automatic matcher refuses to guess when the evidence is weak, which
     * is the right call -- it is why "Pirates" stopped being matched to
     * "Butthole Pirates". But refusing leaves a title with no record at all,
     * and a human looking at the two candidates can often tell instantly what
     * the matcher could not confirm. This is where that answer goes in.
     *
     * Detaching matters just as much: a wrong association renders another
     * film's cast, poster and description over a title whose own metadata was
     * fine, and until the riven-id detail route existed there was no safe way
     * to remove one.
     */
    import { untrack } from "svelte";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import SearchIcon from "@lucide/svelte/icons/search";
    import LinkIcon from "@lucide/svelte/icons/link";
    import Link2OffIcon from "@lucide/svelte/icons/link-2-off";
    import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
    import { toast } from "svelte-sonner";
    import { invalidateAll } from "$app/navigation";

    interface Candidate {
        id: string;
        title: string;
        date: string | null;
        site: string | null;
        poster: string | null;
    }

    interface Props {
        itemId: number;
        title: string;
        currentTpdbId: string | null;
        form?: unknown;
    }

    let { itemId, title, currentTpdbId }: Props = $props();

    let open = $state(false);
    // Seeded from the title once, on purpose: this is an editable search box,
    // and rebinding it to the prop would wipe whatever was typed the moment
    // anything upstream re-rendered.
    let query = $state(untrack(() => title));
    let searching = $state(false);
    let results = $state<Candidate[]>([]);
    let searched = $state(false);
    let confirmDetach = $state(false);
    let busy = $state(false);

    async function search() {
        if (!query.trim()) return;

        searching = true;
        try {
            const response = await fetch(
                `/api/v1/tpdb/search?query=${encodeURIComponent(query.trim())}&type=movie`
            );
            if (!response.ok) throw new Error(`Search returned ${response.status}`);

            const payload = await response.json();
            results = (payload.results ?? payload.data ?? []).map((r: any) => ({
                id: r.tpdb_uuid ?? r.id,
                title: r.title,
                date: r.date ?? r.release_date ?? null,
                site: r.site?.name ?? r.site_name ?? null,
                poster: r.poster ?? r.poster_path ?? null
            }));
            searched = true;
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Search failed");
        } finally {
            searching = false;
        }
    }

    async function apply(tpdbId: string | null) {
        busy = true;
        try {
            const body = new FormData();
            // Empty string means detach -- the action treats a blank id as
            // null rather than needing a separate endpoint for it.
            body.set("tpdbId", tpdbId ?? "");

            const response = await fetch("?/setTpdb", { method: "POST", body });

            if (!response.ok) throw new Error("Could not save");

            toast.success(tpdbId ? "Linked to TPDB record" : "TPDB metadata removed");
            open = false;
            confirmDetach = false;
            await invalidateAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save");
        } finally {
            busy = false;
        }
    }
</script>

<div class="border-border/60 bg-muted/30 mt-2 flex flex-col gap-3 rounded-lg border p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
            <p class="text-sm font-medium">TPDB metadata</p>
            <p class="text-muted-foreground text-xs">
                {#if currentTpdbId}
                    Linked. Cast, poster and description come from that record.
                {:else}
                    Not linked &mdash; showing this title's own metadata. Nothing on TPDB matched
                    it confidently.
                {/if}
            </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onclick={() => {
                    open = !open;
                    if (open && !searched) search();
                }}>
                <SearchIcon class="mr-2 size-4" />
                {currentTpdbId ? "Change" : "Find match"}
            </Button>

            {#if currentTpdbId}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onclick={() => (confirmDetach = true)}>
                    <Link2OffIcon class="mr-2 size-4" />
                    Remove
                </Button>
            {/if}
        </div>
    </div>

    {#if open}
        <div class="flex flex-col gap-3 border-t border-white/10 pt-3">
            <div class="flex items-center gap-2">
                <input
                    type="search"
                    bind:value={query}
                    onkeydown={(e) => e.key === "Enter" && search()}
                    placeholder="Search TPDB"
                    aria-label="Search TPDB for the correct title"
                    class="border-border/60 bg-background focus:border-primary/50 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none" />
                <Button type="button" variant="secondary" size="sm" disabled={searching} onclick={search}>
                    {#if searching}
                        <LoaderCircleIcon class="size-4 animate-spin" />
                    {:else}
                        <SearchIcon class="size-4" />
                    {/if}
                </Button>
            </div>

            {#if searching}
                <p class="text-muted-foreground text-xs">Searching&hellip;</p>
            {:else if searched && !results.length}
                <p class="text-muted-foreground text-xs">
                    Nothing found for &ldquo;{query}&rdquo;. Try the studio name alongside the
                    title &mdash; that is what makes TPDB's own search surface the right record.
                </p>
            {:else}
                <div class="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
                    {#each results as candidate (candidate.id)}
                        <button
                            type="button"
                            disabled={busy}
                            onclick={() => apply(candidate.id)}
                            class="border-border/60 hover:border-primary/50 hover:bg-muted/40 flex items-center gap-3 rounded-lg border p-2 text-left transition-colors disabled:opacity-50">
                            {#if candidate.poster}
                                <img
                                    src={candidate.poster}
                                    alt=""
                                    referrerpolicy="no-referrer"
                                    class="h-14 w-10 shrink-0 rounded object-cover" />
                            {/if}
                            <span class="min-w-0 flex-1">
                                <span class="block truncate text-sm font-medium">
                                    {candidate.title}
                                </span>
                                <span class="text-muted-foreground block truncate text-xs">
                                    {[candidate.site, candidate.date?.slice(0, 10)]
                                        .filter(Boolean)
                                        .join(" · ") || "no studio or date listed"}
                                </span>
                            </span>
                            {#if candidate.id === currentTpdbId}
                                <Badge variant="outline" class="shrink-0 text-[10px]">current</Badge>
                            {:else}
                                <LinkIcon class="text-muted-foreground size-4 shrink-0" />
                            {/if}
                        </button>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<AlertDialog.Root
    open={confirmDetach}
    onOpenChange={(next) => {
        if (!next) confirmDetach = false;
    }}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Remove TPDB metadata?</AlertDialog.Title>
            <AlertDialog.Description>
                This title keeps its own name, cast, poster and downloaded files &mdash; only the
                link to the TPDB record goes. Do this when the linked record is the wrong film.
                You can search for the right one at any time.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel onclick={() => (confirmDetach = false)}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onclick={() => apply(null)}>Remove</AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
