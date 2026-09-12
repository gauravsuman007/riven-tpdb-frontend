<script lang="ts">
    import PageShell from "$lib/components/page-shell.svelte";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import { Button } from "$lib/components/ui/button/index.js";
    import SiteSection from "$lib/components/onlyfans/site-section.svelte";
    import XIcon from "@lucide/svelte/icons/x";
    import BadgeCheckIcon from "@lucide/svelte/icons/badge-check";
    import MapPinIcon from "@lucide/svelte/icons/map-pin";
    import LinkIcon from "@lucide/svelte/icons/link";
    import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
    import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
    import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
    import {
        galleryImages,
        imageUrl,
        streamUrl,
        type OnlyFansGallery,
        type OnlyFansVideo
    } from "$lib/onlyfans";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const account = $derived(data.account);

    let mode = $state<"videos" | "images">("videos");

    /*
        Counts from the performer's own profile. Built as a list and filtered
        rather than rendered one #if at a time, so that an account with two of
        the five shows two neat figures instead of the gaps between them.
    */
    const stats = $derived(
        [
            { label: "photos", value: account.photos_count },
            { label: "videos", value: account.videos_count },
            { label: "posts", value: account.posts_count },
            { label: "likes", value: account.likes_count }
        ]
            .filter((stat): stat is { label: string; value: number } => stat.value != null)
            .map((stat) => ({ label: stat.label, value: stat.value.toLocaleString() }))
    );

    /*
        Which sites have been opened. A section is only mounted once its button
        is clicked, and mounting is what starts the request -- so an unopened
        site costs nothing, and five sites never load at once unless asked for.
    */
    let opened = $state<Set<string>>(new Set());

    function toggleSite(site: string) {
        const next = new Set(opened);
        if (next.has(site)) next.delete(site);
        else next.add(site);
        opened = next;
    }

    // --- Playback -----------------------------------------------------------
    //
    // Through the backend proxy rather than the site's own URL: it carries a
    // short-lived token and these hosts check Referer, so a <video src> pointed
    // straight at it would 403.

    let playing = $state<OnlyFansVideo | null>(null);

    // --- Lightbox -----------------------------------------------------------

    let lightbox = $state<{ gallery: OnlyFansGallery; count: number; index: number } | null>(null);
    let lightboxLoading = $state(false);
    let lightboxError = $state<string | null>(null);

    async function openGallery(gallery: OnlyFansGallery) {
        lightboxLoading = true;
        lightboxError = null;
        const images = await galleryImages(gallery.site, gallery.gallery_id);
        lightboxLoading = false;

        if (!images) {
            lightboxError = "Could not open that gallery";
            return;
        }

        if (images.length === 0) {
            lightboxError = "This site served no images for that gallery";
            return;
        }

        lightbox = { gallery, count: images.length, index: 0 };
    }

    function step(by: number) {
        if (!lightbox) return;
        // Wraps rather than clamping: at six images per gallery, running off
        // the end and stopping feels broken.
        const next = (lightbox.index + by + lightbox.count) % lightbox.count;
        lightbox = { ...lightbox, index: next };
    }

    function onKey(event: KeyboardEvent) {
        if (playing && event.key === "Escape") playing = null;
        if (!lightbox) return;
        if (event.key === "Escape") lightbox = null;
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
    }
</script>

<svelte:head>
    <title>{account.display_name} — OnlyFans — Riven</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

<PageShell
    fallback="/onlyfans"
    class="bg-background relative flex flex-col overflow-x-hidden !pt-6">
    <div class="pointer-events-none fixed inset-0 z-0">
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black"></div>
    </div>

    <div class="relative z-10 mx-auto flex w-full max-w-[2400px] flex-col gap-8 px-4 md:px-16">
        <header class="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
            <!--
                The banner is the performer's own onlyfans.com header and is
                absent far more often than not, so it is a layer behind the
                header rather than a slot in it: when there is none the block
                closes up instead of leaving a hole.
            -->
            {#if account.header_url}
                <div class="relative h-32 w-full md:h-44">
                    <PosterImage src={account.header_url} alt="" />
                    <div
                        class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent">
                    </div>
                </div>
            {/if}

            <div
                class="flex flex-wrap items-start gap-5 p-5 {account.header_url
                    ? '-mt-12 relative'
                    : ''}">
                <div
                    class="relative size-24 shrink-0 overflow-hidden rounded-full border border-white/15 bg-zinc-900">
                    {#if account.avatar_url}
                        <PosterImage src={account.avatar_url} alt={account.display_name} />
                    {/if}
                </div>
                <div class="min-w-0 flex-1">
                    <h1
                        class="flex items-center gap-2 font-serif text-4xl font-medium tracking-tight text-white/90 md:text-5xl">
                        {account.display_name}
                        {#if account.is_verified}
                            <BadgeCheckIcon class="size-5 shrink-0 text-sky-400" />
                        {/if}
                    </h1>
                    <p class="font-mono text-xs text-zinc-500">
                        {account.source_count}
                        {account.source_count === 1 ? "site" : "sites"} · {account.handle}
                    </p>
                    {#if account.bio}
                        <p class="mt-2 max-w-2xl text-sm whitespace-pre-line text-zinc-400">
                            {account.bio}
                        </p>
                    {/if}

                    {#if stats.length}
                        <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                            {#each stats as stat (stat.label)}
                                <span class="text-xs text-zinc-500">
                                    <span class="font-mono text-zinc-300">{stat.value}</span>
                                    {stat.label}
                                </span>
                            {/each}
                        </div>
                    {/if}

                    <div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
                        {#if account.location}
                            <span class="flex items-center gap-1 text-zinc-500">
                                <MapPinIcon class="size-3.5" />
                                {account.location}
                            </span>
                        {/if}
                        {#if account.website}
                            <a
                                href={account.website}
                                target="_blank"
                                rel="noreferrer noopener"
                                class="flex items-center gap-1 text-zinc-400 hover:text-white">
                                <LinkIcon class="size-3.5" />
                                {account.website.replace(/^https?:\/\//, "")}
                            </a>
                        {/if}
                        {#if account.of_url}
                            <a
                                href={account.of_url}
                                target="_blank"
                                rel="noreferrer noopener"
                                class="flex items-center gap-1 text-sky-400 hover:text-sky-300">
                                <ExternalLinkIcon class="size-3.5" />
                                onlyfans.com/{account.of_username}
                            </a>
                        {/if}
                    </div>
                </div>
            </div>
        </header>

        <div class="flex flex-wrap items-center gap-3">
            <div class="flex rounded-full border border-white/10 bg-white/5 p-1">
                {#each ["videos", "images"] as const as option (option)}
                    <button
                        type="button"
                        class="rounded-full px-4 py-1 text-sm capitalize transition {mode === option
                            ? 'bg-white/15 text-white'
                            : 'text-zinc-400 hover:text-white'}"
                        onclick={() => (mode = option)}>
                        {option}
                    </button>
                {/each}
            </div>

            <span class="text-xs text-zinc-500"> Load from: </span>
            {#each account.sources as source (source.site)}
                <Button
                    type="button"
                    variant={opened.has(source.site) ? "default" : "outline"}
                    size="sm"
                    onclick={() => toggleSite(source.site)}>
                    {source.site}
                    {#if source.video_count}
                        <span class="ml-1.5 font-mono text-[10px] opacity-70"
                            >{source.video_count}</span>
                    {/if}
                </Button>
            {/each}
        </div>

        {#if opened.size === 0}
            <p class="text-sm text-zinc-400">
                Pick a site above to load this performer's
                {mode} from it. Nothing is fetched until you do — each site is read live.
            </p>
        {/if}

        {#if lightboxError}
            <p class="text-sm text-red-400">{lightboxError}</p>
        {/if}

        <div class="flex flex-col gap-10">
            {#each account.sources as source (source.site)}
                {#if opened.has(source.site)}
                    <!-- Keyed on site AND mode so switching the toggle remounts
					     with the right kind of request rather than trying to
					     reconcile two different result shapes in one section. -->
                    {#key `${source.site}:${mode}`}
                        <SiteSection
                            handle={account.handle}
                            site={source.site}
                            {mode}
                            onplay={(video) => (playing = video)}
                            onopengallery={openGallery} />
                    {/key}
                {/if}
            {/each}
        </div>
    </div>
</PageShell>

{#if playing}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={playing.title}>
        <button
            type="button"
            class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onclick={() => (playing = null)}
            aria-label="Close player">
            <XIcon class="size-5" aria-hidden="true" />
        </button>
        <div class="flex w-full max-w-5xl flex-col gap-3">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
                class="max-h-[80vh] w-full rounded-lg bg-black"
                src={streamUrl(playing.site, playing.video_id)}
                controls
                autoplay></video>
            <p class="text-sm text-white/80">{playing.title}</p>
        </div>
    </div>
{/if}

{#if lightbox}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={lightbox.gallery.title}>
        <button
            type="button"
            class="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onclick={() => (lightbox = null)}
            aria-label="Close gallery">
            <XIcon class="size-5" aria-hidden="true" />
        </button>

        <button
            type="button"
            class="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onclick={() => step(-1)}
            aria-label="Previous image">
            <ChevronLeftIcon class="size-5" aria-hidden="true" />
        </button>

        <div class="flex max-h-full flex-col items-center gap-3">
            <img
                src={imageUrl(lightbox.gallery.site, lightbox.gallery.gallery_id, lightbox.index)}
                alt={`${lightbox.gallery.title} (${lightbox.index + 1} of ${lightbox.count})`}
                class="max-h-[80vh] rounded-lg object-contain" />
            <p class="font-mono text-xs text-zinc-400">
                {lightbox.index + 1} / {lightbox.count}
                {#if lightbox.gallery.image_count && lightbox.gallery.image_count > lightbox.count}
                    <!-- Said plainly rather than hidden: the gap is the site
					     gating the rest, not a failure to read them. -->
                    <span class="ml-2 text-zinc-500">
                        (of {lightbox.gallery.image_count} — the rest need an account on that site)
                    </span>
                {/if}
            </p>
        </div>

        <button
            type="button"
            class="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onclick={() => step(1)}
            aria-label="Next image">
            <ChevronRightIcon class="size-5" aria-hidden="true" />
        </button>
    </div>
{/if}

{#if lightboxLoading}
    <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
        <p class="text-sm text-white/80">Opening gallery…</p>
    </div>
{/if}
