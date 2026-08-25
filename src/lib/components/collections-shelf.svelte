<!--
    The Collections shelf at the top of the library page.

    These are the user's own collections — hand-curated lists — and they are
    rendered as a single row of cards rather than as their contents, because
    the point of the model is that a collection's entries do not appear in the
    library listing. A collection may hold titles you own and titles you do
    not; the library below holds only what you own.

    Source-built catalogues (AVN, Adult Empire) are deliberately not shown
    here. They have their own pages, and mixing forty award years into this row
    would bury the two or three lists the user actually made.
-->
<script lang="ts">
    import { resolve } from "$app/paths";
    import { invalidateAll } from "$app/navigation";
    import type { CollectionSummary } from "$lib/collections";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { toast } from "svelte-sonner";
    import Bookmark from "@lucide/svelte/icons/bookmark";
    import ChevronRight from "@lucide/svelte/icons/chevron-right";
    import Plus from "@lucide/svelte/icons/plus";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";

    interface Props {
        collections: CollectionSummary[];
    }

    let { collections }: Props = $props();

    let open = $state(false);
    let name = $state("");
    let saving = $state(false);
    let error = $state<string | null>(null);

    async function create() {
        if (!name.trim()) return;

        saving = true;
        error = null;

        try {
            const res = await fetch("/api/v1/collections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() })
            });
            const payload = await res.json();

            if (!res.ok) {
                error = payload?.detail || `Could not create the collection (${res.status})`;
                return;
            }

            toast.success(`Created ${payload.name}`);
            name = "";
            open = false;
            await invalidateAll();
        } catch (e) {
            error = e instanceof Error ? e.message : "Could not reach the server";
        } finally {
            saving = false;
        }
    }
</script>

<section class="flex flex-col gap-4">
    <div class="flex items-end justify-between gap-4">
        <div class="space-y-1">
            <h2 class="font-serif text-2xl font-medium tracking-tight text-white/90">
                Collections
            </h2>
            <div class="flex items-center gap-2 text-zinc-400">
                <span class="font-mono text-xs tracking-widest uppercase">Yours</span>
                <span class="h-px w-8 bg-zinc-700"></span>
                <span class="font-mono text-xs text-zinc-400">
                    {collections.length}
                    {collections.length === 1 ? "collection" : "collections"} · not counted in the library
                </span>
            </div>
        </div>
    </div>

    <ul class="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:thin]">
        {#each collections as collection (collection.key)}
            <li class="flex min-w-[220px] snap-start">
                <a
                    href={resolve(`/collections/${collection.key}`)}
                    class="group relative flex w-full flex-col justify-between gap-4 rounded-2xl border border-white/15 bg-zinc-900/60 p-4 transition-all hover:border-white/35 hover:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                    <div class="flex items-start justify-between gap-2">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <Bookmark class="text-primary h-4 w-4" aria-hidden="true" />
                                <span class="text-base font-medium text-white/90">
                                    {collection.name}
                                </span>
                            </div>
                            {#if collection.description}
                                <p class="line-clamp-2 text-xs text-zinc-400">
                                    {collection.description}
                                </p>
                            {/if}
                        </div>
                        <ChevronRight
                            class="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white/80"
                            aria-hidden="true" />
                    </div>

                    <!--
                        Two different denominators, and the difference is the
                        whole model: `total` is how many titles are in the list,
                        `requested` is how many of them you actually own.
                    -->
                    <dl class="flex items-center gap-4 font-mono text-xs">
                        <div class="space-y-0.5">
                            <dt class="text-zinc-400">Titles</dt>
                            <dd class="text-white/80">{collection.total.toLocaleString()}</dd>
                        </div>
                        <div class="h-6 w-px bg-white/15"></div>
                        <div class="space-y-0.5">
                            <dt class="text-zinc-400">In library</dt>
                            <dd class="text-primary">{collection.requested.toLocaleString()}</dd>
                        </div>
                    </dl>
                </a>
            </li>
        {/each}

        <li class="flex min-w-[220px] snap-start">
            <Dialog.Root bind:open>
                <Dialog.Trigger>
                    {#snippet child({ props })}
                        <button
                            {...props}
                            class="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/25 p-4 text-zinc-300 transition-colors hover:border-white/50 hover:text-white">
                            <Plus class="size-5" aria-hidden="true" />
                            <span class="font-mono text-xs">New collection</span>
                        </button>
                    {/snippet}
                </Dialog.Trigger>

                <Dialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
                    <Dialog.Header>
                        <Dialog.Title>New collection</Dialog.Title>
                        <Dialog.Description>
                            A named list that sits beside the library. Titles you add to it are not
                            downloaded.
                        </Dialog.Description>
                    </Dialog.Header>

                    {#if error}
                        <p class="text-destructive text-sm">{error}</p>
                    {/if}

                    <form
                        class="flex items-center gap-2"
                        onsubmit={(event) => {
                            event.preventDefault();
                            void create();
                        }}>
                        <Input bind:value={name} placeholder="Name" aria-label="Collection name" />
                        <Button type="submit" disabled={!name.trim() || saving}>
                            {#if saving}
                                <LoaderIcon class="size-4 animate-spin" />
                            {:else}
                                <Plus class="size-4" />
                            {/if}
                            Create
                        </Button>
                    </form>
                </Dialog.Content>
            </Dialog.Root>
        </li>
    </ul>
</section>
