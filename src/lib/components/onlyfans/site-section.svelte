<!--
    One site's content for one performer.

    Its own component so each site owns its own paging state, loading flag and
    error. With five sites sharing one set of variables, a slow site would
    block the others and a failing one would blank the lot; here a site that
    errors says so in its own section while the rest keep loading.

    Nothing is cached server-side: every page is read live from the site, which
    is why a section only starts loading once its button is clicked.
-->
<script lang="ts">
    import type { Action } from "svelte/action";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import { Skeleton } from "$lib/components/ui/skeleton/index.js";
    import PlayIcon from "@lucide/svelte/icons/play";
    import ImagesIcon from "@lucide/svelte/icons/images";
    import {
        accountVideos,
        accountGalleries,
        type OnlyFansVideo,
        type OnlyFansGallery
    } from "$lib/onlyfans";

    let {
        handle,
        site,
        mode,
        onplay,
        onopengallery
    }: {
        handle: string;
        site: string;
        mode: "videos" | "images";
        onplay: (video: OnlyFansVideo) => void;
        onopengallery: (gallery: OnlyFansGallery) => void;
    } = $props();

    let videos = $state<OnlyFansVideo[]>([]);
    let galleries = $state<OnlyFansGallery[]>([]);
    let videoPage = $state(0);
    let galleryPage = $state(0);
    let videosDone = $state(false);
    let galleriesDone = $state(false);
    let loading = $state(false);
    let failure = $state<string | null>(null);

    const items = $derived(mode === "videos" ? videos.length : galleries.length);
    const done = $derived(mode === "videos" ? videosDone : galleriesDone);

    async function loadMore() {
        if (loading || done) return;
        loading = true;

        if (mode === "videos") {
            const next = videoPage + 1;
            const result = await accountVideos(handle, site, next);

            if (result === null) {
                failure = `${site} could not be read`;
            } else if (result.length === 0) {
                // An empty page is the site saying there is no more, which is
                // different from the request failing -- hence the null check
                // above rather than treating both as "stop".
                videosDone = true;
            } else {
                const seen = new Set(videos.map((v) => v.video_id));
                const fresh = result.filter((v) => !seen.has(v.video_id));
                // A page that repeats what we already have is also the end:
                // these sites re-serve the last page rather than 404 past it.
                if (fresh.length === 0) videosDone = true;
                videos = [...videos, ...fresh];
                videoPage = next;
                failure = null;
            }
        } else {
            const next = galleryPage + 1;
            const result = await accountGalleries(handle, site, next);

            if (result === null) {
                failure = `${site} could not be read`;
            } else if (result.length === 0) {
                galleriesDone = true;
            } else {
                const seen = new Set(galleries.map((g) => g.gallery_id));
                const fresh = result.filter((g) => !seen.has(g.gallery_id));
                if (fresh.length === 0) galleriesDone = true;
                galleries = [...galleries, ...fresh];
                galleryPage = next;
                failure = null;
            }
        }

        loading = false;
    }

    const infiniteScroll: Action<HTMLDivElement> = (node) => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { threshold: 0.1 }
        );
        observer.observe(node);
        return { destroy: () => observer.disconnect() };
    };

    function runtime(seconds: number | null): string {
        if (!seconds) return "";
        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        return `${minutes}:${String(rest).padStart(2, "0")}`;
    }

    // Kick the first page off as soon as the section is mounted -- mounting is
    // the click.
    loadMore();
</script>

<section class="flex flex-col gap-3">
    <div class="flex items-baseline gap-3">
        <h2 class="font-serif text-2xl text-white/90">{site}</h2>
        <span class="font-mono text-xs text-zinc-500">
            {items}
            {mode === "videos" ? "videos" : "galleries"}{done ? "" : "…"}
        </span>
    </div>

    {#if failure}
        <p class="text-sm text-red-400">{failure}</p>
    {/if}

    {#if items === 0 && done && !failure}
        <p class="text-sm text-zinc-400">
            {#if mode === "images"}
                This site has no galleries for this performer. Only one of the archive sites ties
                galleries to a performer at all.
            {:else}
                This site lists no videos for this performer.
            {/if}
        </p>
    {/if}

    {#if mode === "videos"}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {#each videos as video (video.video_id)}
                <button
                    type="button"
                    class="group flex flex-col gap-2 text-left"
                    onclick={() => onplay(video)}>
                    <div
                        class="relative aspect-video overflow-hidden rounded-lg border border-white/15 bg-zinc-900 transition group-hover:border-white/40">
                        {#if video.thumbnail}
                            <PosterImage src={video.thumbnail} alt={video.title} />
                        {/if}
                        <div
                            class="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                            <PlayIcon class="size-8 text-white drop-shadow" aria-hidden="true" />
                        </div>
                        {#if video.duration}
                            <span
                                class="absolute right-1 bottom-1 rounded bg-black/80 px-1 font-mono text-[10px] text-white/90">
                                {runtime(video.duration)}
                            </span>
                        {/if}
                    </div>
                    <p class="line-clamp-2 text-xs text-white/80">{video.title}</p>
                </button>
            {/each}

            {#if loading}
                {#each [...Array(5).keys()] as index (index)}
                    <Skeleton class="aspect-video rounded-lg" />
                {/each}
            {/if}
        </div>
    {:else}
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {#each galleries as gallery (gallery.gallery_id)}
                <button
                    type="button"
                    class="group flex flex-col gap-2 text-left"
                    onclick={() => onopengallery(gallery)}>
                    <div
                        class="relative aspect-[3/4] overflow-hidden rounded-lg border border-white/15 bg-zinc-900 transition group-hover:border-white/40">
                        {#if gallery.cover}
                            <PosterImage src={gallery.cover} alt={gallery.title} />
                        {/if}
                        <div
                            class="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                            <ImagesIcon class="size-7 text-white drop-shadow" aria-hidden="true" />
                        </div>
                    </div>
                    <p class="line-clamp-2 text-xs text-white/80">{gallery.title}</p>
                    {#if gallery.image_count}
                        <p class="font-mono text-[10px] text-zinc-500">
                            {gallery.image_count} images
                        </p>
                    {/if}
                </button>
            {/each}

            {#if loading}
                {#each [...Array(6).keys()] as index (index)}
                    <Skeleton class="aspect-[3/4] rounded-lg" />
                {/each}
            {/if}
        </div>
    {/if}

    {#if !done && !failure}
        <div use:infiniteScroll class="h-10"></div>
    {/if}
</section>
