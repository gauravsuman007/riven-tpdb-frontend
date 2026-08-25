<script lang="ts">
    /**
     * Add this title to a user collection, or to a new one.
     *
     * Deliberately does NOT request the title. A collection is a list of things
     * you are interested in; the library is what you own. The Request button
     * next to this one is what starts a download.
     *
     * The three id props are alternatives, not a set — whichever one the page
     * has. A TPDB page knows a uuid, the library knows a Riven id, and a
     * brochure or award page knows a catalogue entry id. For an Adult Empire
     * entry the backend attempts a TPDB lookup while adding, so the title lands
     * in the collection with the same artwork and ids a TPDB title arrives
     * with; if TPDB has no record it is added on Adult Empire's metadata alone.
     */
    import { Button } from "$lib/components/ui/button/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import { toast } from "svelte-sonner";
    import BookmarkPlusIcon from "@lucide/svelte/icons/bookmark-plus";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import PlusIcon from "@lucide/svelte/icons/plus";
    import CheckIcon from "@lucide/svelte/icons/check";

    interface Props {
        tpdbId?: string | null;
        tpdbKind?: string;
        mediaItemId?: number | null;
        entryId?: number | null;
        variant?: "default" | "outline" | "secondary" | "ghost";
        size?: "default" | "sm" | "lg" | "icon";
    }

    let {
        tpdbId = null,
        tpdbKind = "movie",
        mediaItemId = null,
        entryId = null,
        variant = "outline",
        size = "default"
    }: Props = $props();

    interface Summary {
        key: string;
        name: string;
        total: number;
    }

    let open = $state(false);
    let loading = $state(false);
    let saving = $state<string | null>(null);
    let error = $state<string | null>(null);
    let collections = $state<Summary[]>([]);
    let newName = $state("");
    // Keys this title has been added to during this dialog session. The list
    // endpoint has no per-title membership, so remembering locally is what
    // stops a second click from looking like it did nothing.
    let added = $state<Set<string>>(new Set());

    function body() {
        return {
            tpdb_id: tpdbId,
            tpdb_kind: tpdbKind,
            media_item_id: mediaItemId,
            entry_id: entryId
        };
    }

    async function load() {
        loading = true;
        error = null;

        try {
            const res = await fetch("/api/v1/collections?source=user");
            const payload = await res.json();

            if (!res.ok) {
                error = payload?.detail || `Could not load collections (${res.status})`;
                return;
            }

            collections = payload ?? [];
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reach the server";
        } finally {
            loading = false;
        }
    }

    async function add(key: string) {
        saving = key;
        error = null;

        try {
            const res = await fetch(`/api/v1/collections/${encodeURIComponent(key)}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body())
            });
            const payload = await res.json();

            if (!res.ok) {
                error = payload?.detail || `Could not add (${res.status})`;
                return;
            }

            toast.success(
                `Added to ${collections.find((c) => c.key === key)?.name ?? "collection"}`
            );
            added = new Set([...added, key]);
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reach the server";
        } finally {
            saving = null;
        }
    }

    /*
        Create then add, as two calls. The collection's key is assigned
        server-side (names are free text, keys are URL segments and are
        de-duplicated), so the key has to come back from the create before the
        add can address it — guessing it from the name would silently add to
        whichever older collection happened to own that slug.
    */
    async function createAndAdd(name: string) {
        saving = "new";
        error = null;

        try {
            const res = await fetch("/api/v1/collections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const payload = await res.json();

            if (!res.ok) {
                error = payload?.detail || `Could not create the collection (${res.status})`;
                return;
            }

            collections = [...collections, { key: payload.key, name: payload.name, total: 0 }];
            newName = "";
            await add(payload.key);
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reach the server";
        } finally {
            saving = null;
        }
    }

    $effect(() => {
        if (open && !collections.length && !loading && !error) {
            void load();
        }
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button {...props} {variant} {size}>
                <BookmarkPlusIcon class="mr-2 size-4" />
                Add to collection
            </Button>
        {/snippet}
    </Dialog.Trigger>

    <Dialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <Dialog.Header>
            <Dialog.Title>Add to collection</Dialog.Title>
            <Dialog.Description>
                Collections sit beside the library. Adding a title here does not download it.
            </Dialog.Description>
        </Dialog.Header>

        {#if error}
            <p class="text-destructive text-sm">{error}</p>
        {/if}

        {#if loading}
            <div class="flex items-center gap-2 py-6 text-sm text-zinc-400">
                <LoaderIcon class="size-4 animate-spin" />
                Loading collections…
            </div>
        {:else}
            <ul class="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {#each collections as collection (collection.key)}
                    <li>
                        <button
                            type="button"
                            class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10 disabled:opacity-60"
                            disabled={saving !== null || added.has(collection.key)}
                            onclick={() => add(collection.key)}>
                            <span class="text-white/90">{collection.name}</span>
                            {#if saving === collection.key}
                                <LoaderIcon class="size-4 animate-spin" />
                            {:else if added.has(collection.key)}
                                <CheckIcon class="size-4 text-emerald-400" />
                            {:else}
                                <span class="font-mono text-xs text-zinc-500">
                                    {collection.total}
                                </span>
                            {/if}
                        </button>
                    </li>
                {:else}
                    <li class="px-3 py-2 text-sm text-zinc-400">
                        No collections yet — name one below.
                    </li>
                {/each}
            </ul>
        {/if}

        <Dialog.Footer class="sm:justify-start">
            <form
                class="flex w-full items-center gap-2"
                onsubmit={(event) => {
                    event.preventDefault();
                    if (newName.trim()) void createAndAdd(newName.trim());
                }}>
                <Input
                    bind:value={newName}
                    placeholder="New collection name"
                    aria-label="New collection name" />
                <Button type="submit" disabled={!newName.trim() || saving !== null}>
                    {#if saving === "new"}
                        <LoaderIcon class="size-4 animate-spin" />
                    {:else}
                        <PlusIcon class="size-4" />
                    {/if}
                    Create
                </Button>
            </form>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
