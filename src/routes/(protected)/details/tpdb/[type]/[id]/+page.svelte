<script lang="ts">
    import type { PageData, ActionData } from "./$types";
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import ListItem from "$lib/components/list-item.svelte";
    import PageShell from "$lib/components/page-shell.svelte";
    import DownloadIcon from "@lucide/svelte/icons/download";
    import BookmarkIcon from "@lucide/svelte/icons/bookmark";

    let { data, form }: { data: PageData; form: ActionData } = $props();

    const item = $derived(data.item as Record<string, any>);
    const collected = $derived(data.collected || (form as any)?.collected === true);
    const requested = $derived((form as any)?.requested === true);

    const poster = $derived(item.poster || item.posters?.large || item.image || null);
    const backdrop = $derived(item.background?.full || item.background?.large || null);
    const performers = $derived((item.performers ?? []).filter((p: any) => p?.name));
    const tags = $derived((item.tags ?? []).filter((t: any) => t?.name));

    // TPDB reports duration in seconds.
    const runtime = $derived.by(() => {
        const seconds = Number(item.duration ?? 0);
        if (!seconds) return null;
        const h = Math.floor(seconds / 3600);
        const m = Math.round((seconds % 3600) / 60);
        return h ? `${h}h ${m}m` : `${m}m`;
    });
</script>

<svelte:head>
    <title>{item.title || "Title"} - Riven TPDB</title>
</svelte:head>

<PageShell class="bg-background relative flex min-h-screen flex-col overflow-x-hidden">
    {#if backdrop}
        <div class="pointer-events-none absolute inset-x-0 top-0 h-[60vh]">
            <img src={backdrop} alt="" class="h-full w-full object-cover opacity-30" />
            <div class="from-background absolute inset-0 bg-gradient-to-t via-transparent"></div>
        </div>
    {/if}

    <div
        class="relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-6 pt-10 pb-24 md:px-12 md:pt-20">
        <div class="flex flex-col gap-8 md:flex-row">
            {#if poster}
                <img
                    src={poster}
                    alt={item.title}
                    class="w-56 shrink-0 self-start rounded-2xl shadow-2xl shadow-black/50" />
            {/if}

            <div class="flex flex-col gap-4">
                <h1 class="text-foreground text-3xl font-black tracking-tight sm:text-5xl">
                    {item.title}
                </h1>

                <div class="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                    {#if item.site?.name}<span class="font-semibold">{item.site.name}</span>{/if}
                    {#if item.date}<span>{item.date}</span>{/if}
                    {#if runtime}<span>{runtime}</span>{/if}
                </div>

                {#if item.description}
                    <p class="text-muted-foreground max-w-3xl leading-relaxed">
                        {item.description}
                    </p>
                {/if}

                {#if performers.length}
                    <div class="flex flex-wrap gap-2">
                        {#each performers as performer (performer.id ?? performer.name)}
                            <Badge variant="secondary">{performer.name}</Badge>
                        {/each}
                    </div>
                {/if}

                {#if tags.length}
                    <div class="flex flex-wrap gap-1.5">
                        {#each tags.slice(0, 20) as tag (tag.id ?? tag.name)}
                            <Badge variant="outline" class="text-xs">{tag.name}</Badge>
                        {/each}
                    </div>
                {/if}

                <div class="mt-2 flex flex-wrap items-center gap-3">
                    <form method="POST" action="?/request" use:enhance>
                        <input type="hidden" name="uuid" value={item.id} />
                        <input type="hidden" name="type" value={data.type} />
                        <Button type="submit" disabled={requested}>
                            <DownloadIcon class="mr-2 size-4" />
                            {requested ? "Queued in Riven" : "Request"}
                        </Button>
                    </form>

                    {#if data.numericId}
                        <form method="POST" action="?/collect" use:enhance>
                            <input type="hidden" name="numericId" value={data.numericId} />
                            <Button type="submit" variant="outline" disabled={collected}>
                                <BookmarkIcon class="mr-2 size-4" />
                                {collected ? "In TPDB collection" : "Add to TPDB collection"}
                            </Button>
                        </form>
                    {/if}
                </div>

                {#if collected}
                    <p class="text-muted-foreground text-xs">
                        TPDB has no endpoint for removing a title from a collection, so this
                        cannot be undone from here.
                    </p>
                {/if}

                {#if (form as any)?.message}
                    <p class="text-destructive text-sm">{(form as any).message}</p>
                {/if}
            </div>
        </div>

        {#if data.similar.length}
            <div class="flex flex-col gap-4">
                <h2 class="text-foreground text-2xl font-bold tracking-tight">Related on TPDB</h2>
                <div
                    class="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                    {#each data.similar as related (related.id)}
                        <div class="aspect-[2/3] w-full">
                            <ListItem data={related} indexer="tpdb" type={data.type} />
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</PageShell>
