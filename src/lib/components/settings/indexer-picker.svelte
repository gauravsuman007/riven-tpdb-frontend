<script lang="ts">
    /**
     * Choose which Prowlarr indexers Riven searches.
     *
     * A scrape queries every enabled indexer and waits for the slowest, so an
     * instance with dozens configured makes every search as slow as its worst
     * member -- 60s here before this existed. The backend treats an empty
     * selection as "search all", which is why clearing the list is offered as
     * an explicit action rather than something you fall into.
     *
     * This is deliberately outside the generated settings form: the schema
     * renders `indexer_ids` as a bare array of integers, which is unusable
     * without knowing the ids by heart.
     */
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { toast } from "svelte-sonner";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import SearchIcon from "@lucide/svelte/icons/search";

    interface Indexer {
        id: number;
        name: string;
        enabled: boolean;
        protocol: string;
    }

    let open = $state(false);
    let loading = $state(false);
    let saving = $state(false);
    let error = $state<string | null>(null);
    let indexers = $state<Indexer[]>([]);
    let selected = $state<Set<number>>(new Set());
    let filter = $state("");

    const visible = $derived(
        indexers.filter((indexer) => indexer.name.toLowerCase().includes(filter.toLowerCase()))
    );

    async function load() {
        loading = true;
        error = null;

        try {
            const res = await fetch("/api/v1/scrape/indexers");
            const body = await res.json();

            if (!res.ok) {
                error = body?.detail || `Could not load indexers (${res.status})`;
                return;
            }

            indexers = body.indexers ?? [];
            selected = new Set<number>(body.selected ?? []);
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reach the server";
        } finally {
            loading = false;
        }
    }

    function toggle(id: number) {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        selected = next;
    }

    async function save() {
        saving = true;

        try {
            const res = await fetch("/api/v1/settings/set/all", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scraping: { prowlarr: { indexer_ids: [...selected] } }
                })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                toast.error(body?.detail || `Could not save (${res.status})`);
                return;
            }

            toast.success(
                selected.size
                    ? `Searching ${selected.size} indexer${selected.size === 1 ? "" : "s"}`
                    : "Searching all indexers"
            );
            open = false;
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save");
        } finally {
            saving = false;
        }
    }

    $effect(() => {
        if (open) load();
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button {...props} variant="outline" size="sm">Choose indexers…</Button>
        {/snippet}
    </Dialog.Trigger>

    <Dialog.Content class="flex max-h-[80vh] flex-col sm:max-w-lg">
        <Dialog.Header>
            <Dialog.Title>Prowlarr indexers</Dialog.Title>
            <Dialog.Description>
                Pick the indexers to search. A scrape waits for the slowest one, so fewer is faster.
                Selecting none searches all of them.
            </Dialog.Description>
        </Dialog.Header>

        {#if loading}
            <div class="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                <LoaderIcon class="size-4 animate-spin" />
                Asking Prowlarr what it has…
            </div>
        {:else if error}
            <p class="text-destructive py-6 text-sm">{error}</p>
        {:else}
            <div class="relative">
                <SearchIcon
                    class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <input
                    bind:value={filter}
                    placeholder="Filter indexers"
                    class="border-input bg-background w-full rounded-md border py-2 pr-3 pl-9 text-sm" />
            </div>

            <div class="-mx-1 flex-1 overflow-y-auto px-1">
                {#each visible as indexer (indexer.id)}
                    <label
                        class="hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm">
                        <input
                            type="checkbox"
                            checked={selected.has(indexer.id)}
                            onchange={() => toggle(indexer.id)}
                            class="size-4 shrink-0" />
                        <span class="min-w-0 flex-1 truncate">{indexer.name}</span>
                        {#if !indexer.enabled}
                            <Badge variant="outline" class="shrink-0 text-[10px]">
                                disabled in Prowlarr
                            </Badge>
                        {/if}
                    </label>
                {:else}
                    <p class="text-muted-foreground py-6 text-center text-sm">
                        No indexers match "{filter}".
                    </p>
                {/each}
            </div>
        {/if}

        <Dialog.Footer class="flex-row items-center justify-between gap-2 sm:justify-between">
            <span class="text-muted-foreground text-xs">
                {selected.size
                    ? `${selected.size} of ${indexers.length} selected`
                    : `All ${indexers.length} will be searched`}
            </span>

            <div class="flex gap-2">
                <Button variant="ghost" size="sm" onclick={() => (selected = new Set())}>
                    Clear
                </Button>
                <Button size="sm" onclick={save} disabled={saving || loading}>
                    {saving ? "Saving…" : "Save"}
                </Button>
            </div>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
