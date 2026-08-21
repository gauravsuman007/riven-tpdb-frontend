<script lang="ts">
    import { browser } from "$app/environment";
    import { page } from "$app/state";
    import { type PageProps } from "./$types";
    import type { ParsedShowDetails } from "$lib/metadata/parser";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import * as Carousel from "$lib/components/ui/carousel/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import PortraitCard from "$lib/components/media/portrait-card.svelte";
    import CollectionSheet from "$lib/components/media/collection-sheet.svelte";
    import StatusBadge from "$lib/components/media/status-badge.svelte";
    import BackdropBackground from "$lib/components/media/backdrop-background.svelte";
    import SectionHeading from "$lib/components/media/section-heading.svelte";
    import RatingsRow from "$lib/components/media/ratings-row.svelte";
    import MoreDetailsPanel from "$lib/components/media/more-details-panel.svelte";
    import HeroBanner from "$lib/components/media/riven/hero-banner.svelte";
    import ItemActionToolbar from "$lib/components/media/riven/item-action-toolbar.svelte";
    import FileInformationPanel from "$lib/components/media/riven/file-information-panel.svelte";
    import LiveSeasons from "./live-seasons.svelte";
    import LiveEpisodes from "./live-episodes.svelte";
    import { toast } from "svelte-sonner";
    import { gqlClient, gqlSubscribeClient } from "$lib/graphql-client";
    import type { RivenMediaItem } from "$lib/types/riven";
    import {
        MEDIA_ITEM_FULL_BY_TMDB_QUERY,
        MEDIA_ITEM_FULL_BY_TVDB_QUERY,
        RAW_RIVEN_DATA_BY_TMDB_QUERY,
        RAW_RIVEN_DATA_BY_TVDB_QUERY,
        MEDIA_ITEM_STATE_BY_TMDB_QUERY,
        MEDIA_ITEM_STATE_BY_TVDB_QUERY,
        MEDIA_ITEM_STATE_UPDATES_BY_TMDB_SUBSCRIPTION,
        MEDIA_ITEM_STATE_UPDATES_BY_TVDB_SUBSCRIPTION,
        SHOW_INDEXED_SUBSCRIPTION,
        mapMediaItemStateTree,
        mapMediaItemFull,
        type GqlMediaItemFull,
        type GqlMediaItemStateTree,
        type GqlIndexedShow
    } from "$lib/services/riven-media";
    import { untrack } from "svelte";
    import { SvelteMap } from "svelte/reactivity";
    import { resolve } from "$app/paths";

    let { data }: PageProps = $props();

    const externalMeta: Record<string, { name: string; url: string }> = {
        imdb: { name: "IMDb", url: "https://www.imdb.com/title/" },
        facebook: { name: "Facebook", url: "https://www.facebook.com/" },
        instagram: { name: "Instagram", url: "https://www.instagram.com/" },
        twitter: { name: "Twitter", url: "https://www.twitter.com/" },
        reddit: { name: "Reddit", url: "https://www.reddit.com/r/" },
        "themoviedb.com": { name: "TMDB", url: "https://www.themoviedb.org/tv/" },
        eidr: { name: "EIDR", url: "https://ui.eidr.org/view/content?id=" }
    };
    const getExternal = (key: string) => externalMeta[key.replace("_id", "")];

    function mediaHref(id: number | string, mediaType: string) {
        return resolve("/(protected)/details/media/[id]/[mediaType]", {
            id: String(id),
            mediaType
        });
    }

    function entityHref(id: number | string, type: string, query?: string) {
        const path = resolve("/(protected)/details/entity/[id]/[type]", {
            id: String(id),
            type
        });
        return query ? `${path}?${query}` : path;
    }

    let liveRiven = $state<RivenMediaItem | undefined>(untrack(() => data.riven));
    let hydratedRiven = $state<RivenMediaItem | undefined>(undefined);
    let liveRivenItemId = $state<number | undefined>(untrack(() => data.riven?.id));
    let rivenPending = $state(untrack(() => Boolean(data.rivenPending)));
    let completedDetailsHydrating = false;
    let lastHydratedCompletedKey = "";
    let rawDataOpen = $state(false);
    let rawRivenLoading = $state(false);
    let rawRivenError = $state<string | undefined>(undefined);
    let rawRivenData = $state<unknown>(undefined);
    let selectedMovieVersionIdx = $state(0);

    const riven = $derived(liveRiven ?? hydratedRiven);
    const rawRivenDisplayData = $derived(
        rawRivenData ?? (rawRivenLoading ? undefined : (hydratedRiven ?? riven))
    );
    const rawRivenJson = $derived(JSON.stringify(rawRivenDisplayData, null, 2));

    const episodeCountBySeasonNumber = $derived.by(() => {
        if (data.mediaDetails?.type !== "tv") return undefined;

        const details = data.mediaDetails.details as ParsedShowDetails;
        const counts = new SvelteMap<number, number>();

        for (const episode of details.episodes ?? []) {
            if (episode.seasonNumber == null) continue;
            counts.set(episode.seasonNumber, (counts.get(episode.seasonNumber) ?? 0) + 1);
        }

        return counts;
    });

    const completedFileCount = $derived.by(() => {
        if (!riven) return 0;
        if (data.mediaDetails?.type === "movie") {
            return riven.state === "Completed" ? 1 : 0;
        }
        return (
            riven.seasons?.reduce(
                (acc, season) =>
                    acc + (season.episodes?.filter((e) => e.state === "Completed").length ?? 0),
                0
            ) ?? 0
        );
    });

    const totalFileCount = $derived.by(() => {
        if (!riven) return 0;
        if (data.mediaDetails?.type === "movie") {
            return 1;
        }

        const details = data.mediaDetails?.details as ParsedShowDetails | undefined;
        return details?.episode_count ?? 0;
    });

    function getInitialSeason() {
        if (data.mediaDetails?.type !== "tv") return "1";
        const requestedSeason = page.url.searchParams.get("season");
        if (requestedSeason && !Number.isNaN(Number(requestedSeason))) {
            return requestedSeason;
        }
        const details = data.mediaDetails?.details as ParsedShowDetails;
        if (!details?.seasons?.length) return "1";

        const hasSeason1 = details.seasons.some((s) => s.number === 1);
        return hasSeason1 ? "1" : (details.seasons[0].number?.toString() ?? "1");
    }

    function getInitialEpisode() {
        if (data.mediaDetails?.type !== "tv") return undefined;
        const requestedEpisode = page.url.searchParams.get("episode");
        return requestedEpisode && !Number.isNaN(Number(requestedEpisode))
            ? requestedEpisode
            : undefined;
    }

    let selectedSeason: string | undefined = $state(getInitialSeason());
    let selectedEpisode: string | undefined = $state(getInitialEpisode());

    function getMovieEntries() {
        const item = hydratedRiven ?? riven;

        return item?.filesystem_entries?.length
            ? item.filesystem_entries
            : item?.filesystem_entry
              ? [item.filesystem_entry]
              : [];
    }

    const movieFileEntries = $derived(getMovieEntries());

    const externalLinks = $derived.by(() => {
        const externalIds = data.mediaDetails?.details.external_ids;
        if (!externalIds) return [];
        return Object.entries(externalIds).flatMap(([key, value]) => {
            const meta = getExternal(key);
            if (!value || !meta) return [];
            return [{ key, label: meta.name, url: `${meta.url}${value}` }];
        });
    });

    async function deleteFilesystemEntry(id: number, label: string) {
        if (
            !confirm(
                `Remove version "${label}"? This only removes the tracked file entry — the actual file is not deleted.`
            )
        )
            return;
        try {
            await gqlClient<{ deleteFilesystemEntry: boolean }>(
                `mutation DeleteFilesystemEntry($id: Int!) { deleteFilesystemEntry(id: $id) }`,
                { id }
            );
            selectedMovieVersionIdx = 0;
            toast.success(`Version "${label}" removed`);
        } catch {
            toast.error("Failed to remove version");
        }
    }

    async function handleRequestSuccess() {
        if (rivenPending) {
            return;
        }

        await hydrateInitialState();
    }

    $effect(() => {
        // Track ID changes to reset selected season
        selectedSeason = getInitialSeason();
        selectedEpisode = getInitialEpisode();
        selectedMovieVersionIdx = 0;
        liveRiven = data.riven;
        hydratedRiven = undefined;
        liveRivenItemId = data.riven?.id;
        rivenPending = Boolean(data.rivenPending);
        lastHydratedCompletedKey = "";
        completedDetailsHydrating = false;
        rawDataOpen = false;
        rawRivenLoading = false;
        rawRivenError = undefined;
        rawRivenData = undefined;
    });

    let rivenId = $derived(riven?.id ?? data.mediaDetails?.details?.id);

    // For ratings, we need TMDB ID. For TV shows, check external_ids.tmdb first (in case URL has TVDB ID)
    let ratingsId = $derived(
        data.mediaDetails?.type === "tv"
            ? (data.mediaDetails?.details.external_ids?.tmdb ?? Number(page.params.id))
            : Number(page.params.id)
    );
    let mediaType = $derived(data.mediaDetails?.type);

    let ratingsData = $state<{
        scores: Array<{ name: string; image?: string; score: string; url: string }>;
    } | null>(null);
    let ratingsLoading = $state(false);

    $effect(() => {
        if (!browser || !ratingsId || !mediaType) {
            ratingsLoading = false;
            ratingsData = null;
            return;
        }

        const controller = new AbortController();
        ratingsLoading = true;

        gqlClient<{
            ratings: {
                scores: Array<{ name: string; image?: string; score: string; url: string }>;
            };
        }>(
            `query Ratings($id: String!, $mediaType: String!) {
                ratings(indexer: "tmdb", id: $id, mediaType: $mediaType) {
                    scores { name image score url }
                }
            }`,
            { id: String(ratingsId), mediaType },
            controller.signal
        )
            .then(({ ratings }) => {
                ratingsData = ratings;
                ratingsLoading = false;
            })
            .catch((e) => {
                if (e.name !== "AbortError") {
                    ratingsLoading = false;
                    ratingsData = null;
                }
            });

        return () => controller.abort();
    });

    const seasonData = $derived.by(() => {
        if (data.mediaDetails?.type !== "tv" || !data.mediaDetails?.details?.seasons) return [];
        const details = data.mediaDetails.details as ParsedShowDetails;
        const episodeCountBySeason = new SvelteMap<number, number>();
        const seasonsByNumber = new SvelteMap(
            (liveRiven?.seasons ?? []).map((season) => [season.season_number, season])
        );

        for (const episode of details.episodes ?? []) {
            if (episode.seasonNumber == null) continue;
            episodeCountBySeason.set(
                episode.seasonNumber,
                (episodeCountBySeason.get(episode.seasonNumber) ?? 0) + 1
            );
        }

        return details.seasons.map((s) => {
            const rivenSeason = seasonsByNumber.get(s.number ?? 0);
            const episodeCount = episodeCountBySeason.get(s.number ?? 0) ?? 0;
            const completedCount =
                rivenSeason?.episodes?.filter((e) => e.state === "Completed").length ?? 0;
            const isComplete = episodeCount > 0 && completedCount >= episodeCount;
            return {
                id: s.id,
                season_number: s.number ?? 0,
                episode_count: episodeCount,
                completed_count: rivenSeason ? completedCount : undefined,
                name: `Season ${s.number}`,
                status: isComplete ? "Available" : undefined
            };
        });
    });

    const rivenSeasonsByNumber = $derived.by(
        () =>
            new SvelteMap(
                (liveRiven?.seasons ?? []).map((season) => [season.season_number, season])
            )
    );

    const selectedRivenSeason = $derived.by(() =>
        selectedSeason ? rivenSeasonsByNumber.get(Number(selectedSeason)) : undefined
    );

    const selectedRivenEpisodesByNumber = $derived.by(
        () =>
            new SvelteMap(
                (selectedRivenSeason?.episodes ?? []).map((episode) => [
                    episode.episode_number,
                    episode
                ])
            )
    );

    const selectedHydratedSeason = $derived.by(() =>
        selectedSeason
            ? hydratedRiven?.seasons?.find(
                  (season) => season.season_number === Number(selectedSeason)
              )
            : undefined
    );

    const selectedHydratedEpisodesByNumber = $derived.by(
        () =>
            new SvelteMap(
                (selectedHydratedSeason?.episodes ?? []).map((episode) => [
                    episode.episode_number,
                    episode
                ])
            )
    );

    const formatSize = (b: number) => `${(b / 1073741824).toFixed(2)} GB`;

    const details = $derived(
        [
            data.mediaDetails?.details.year,
            data.mediaDetails?.details.formatted_runtime,
            data.mediaDetails?.details.original_language?.toUpperCase(),
            data.mediaDetails?.details.certification,
            data.mediaDetails?.details.status
        ].filter(Boolean)
    );

    function getLiveRivenSubscription() {
        if (data.mediaDetails?.type === "movie") {
            return {
                query: MEDIA_ITEM_STATE_UPDATES_BY_TMDB_SUBSCRIPTION,
                variables: { tmdbId: page.params.id },
                resultKey: "mediaItemStateUpdatesByTmdb" as const
            };
        }

        if (data.mediaDetails?.type === "tv" && data.resolvedTvdbId != null) {
            return {
                query: MEDIA_ITEM_STATE_UPDATES_BY_TVDB_SUBSCRIPTION,
                variables: { tvdbId: data.resolvedTvdbId.toString() },
                resultKey: "mediaItemStateUpdatesByTvdb" as const
            };
        }

        return null;
    }

    function getCompletedDetailsRequest() {
        if (data.mediaDetails?.type === "movie") {
            return {
                query: MEDIA_ITEM_FULL_BY_TMDB_QUERY,
                variables: { tmdbId: page.params.id },
                resultKey: "mediaItemFullByTmdb" as const
            };
        }

        if (data.mediaDetails?.type === "tv" && data.resolvedTvdbId != null) {
            return {
                query: MEDIA_ITEM_FULL_BY_TVDB_QUERY,
                variables: { tvdbId: data.resolvedTvdbId.toString() },
                resultKey: "mediaItemFullByTvdb" as const
            };
        }

        return null;
    }

    function getInitialStateRequest() {
        if (data.mediaDetails?.type === "movie") {
            return {
                query: MEDIA_ITEM_STATE_BY_TMDB_QUERY,
                variables: { tmdbId: page.params.id },
                resultKey: "mediaItemStateByTmdb" as const
            };
        }

        if (data.mediaDetails?.type === "tv" && data.resolvedTvdbId != null) {
            return {
                query: MEDIA_ITEM_STATE_BY_TVDB_QUERY,
                variables: { tvdbId: data.resolvedTvdbId.toString() },
                resultKey: "mediaItemStateByTvdb" as const
            };
        }

        return null;
    }

    function getRawDataRequest() {
        if (data.mediaDetails?.type === "movie") {
            return {
                query: RAW_RIVEN_DATA_BY_TMDB_QUERY,
                variables: { tmdbId: page.params.id },
                resultKey: "mediaItemFullByTmdb" as const
            };
        }

        if (data.mediaDetails?.type === "tv" && data.resolvedTvdbId != null) {
            return {
                query: RAW_RIVEN_DATA_BY_TVDB_QUERY,
                variables: { tvdbId: data.resolvedTvdbId.toString() },
                resultKey: "mediaItemFullByTvdb" as const
            };
        }

        return null;
    }

    // A signature of the currently-completed content. Episode file details
    // (filesystem entries, media metadata) aren't carried by the live state
    // subscription, so they must be fetched separately. We key the fetch on the
    // set of completed episodes so partially-completed shows hydrate the episodes
    // that ARE done, and re-hydrate as more episodes complete — without looping
    // forever when a completed item has no filesystem entry yet.
    function completedDetailsSignature(item: RivenMediaItem | undefined) {
        if (!item) {
            return "";
        }

        if (data.mediaDetails?.type === "movie") {
            return item.state === "Completed" ? `m:${item.id}` : "";
        }

        const keys: string[] = [];
        for (const season of item.seasons ?? []) {
            for (const episode of season.episodes ?? []) {
                if (episode.state === "Completed") {
                    keys.push(`${season.season_number}.${episode.episode_number}`);
                }
            }
        }

        return keys.length ? `t:${item.id}:${keys.join(",")}` : "";
    }

    function needsCompletedDetailsHydration(item: RivenMediaItem | undefined) {
        const signature = completedDetailsSignature(item);
        return signature !== "" && signature !== lastHydratedCompletedKey;
    }

    async function hydrateCompletedDetails() {
        if (completedDetailsHydrating) {
            return;
        }

        const signature = completedDetailsSignature(riven);

        if (!signature || signature === lastHydratedCompletedKey) {
            return;
        }

        const request = getCompletedDetailsRequest();

        if (!request) {
            return;
        }

        completedDetailsHydrating = true;

        try {
            const payload = await gqlClient<{
                mediaItemFullByTmdb?: GqlMediaItemFull | null;
                mediaItemFullByTvdb?: GqlMediaItemFull | null;
            }>(request.query, request.variables);
            const full = mapMediaItemFull(payload[request.resultKey]) ?? undefined;

            if (full) {
                hydratedRiven = full;
            }

            lastHydratedCompletedKey = signature;
        } catch {
            // non-critical, ignore
        } finally {
            completedDetailsHydrating = false;
        }
    }

    async function fetchRawRivenData() {
        if (rawRivenLoading || rawRivenData) {
            return;
        }

        const request = getRawDataRequest();

        if (!request) {
            return;
        }

        rawRivenLoading = true;
        rawRivenError = undefined;

        try {
            const payload = await gqlClient<{
                mediaItemFullByTmdb?: unknown;
                mediaItemFullByTvdb?: unknown;
            }>(request.query, request.variables);
            const raw = payload[request.resultKey];

            if (raw) {
                rawRivenData = raw;
            } else {
                rawRivenError = "No full Riven data was returned for this item.";
            }
        } catch (error) {
            rawRivenError =
                error instanceof Error ? error.message : "Failed to load full Riven data.";
        } finally {
            rawRivenLoading = false;
        }
    }

    function applyLiveState(raw: GqlMediaItemStateTree | null | undefined) {
        const nextState = mapMediaItemStateTree(raw) ?? undefined;

        if (nextState && raw) {
            liveRiven = nextState;
            liveRivenItemId = nextState.id;
            return;
        }

        liveRiven = undefined;
        hydratedRiven = undefined;
        liveRivenItemId = undefined;
        lastHydratedCompletedKey = "";
    }

    async function hydrateInitialState() {
        const request = getInitialStateRequest();

        if (!request) {
            return;
        }

        rivenPending = true;

        try {
            const payload = await gqlClient<{
                mediaItemStateByTmdb?: GqlMediaItemStateTree | null;
                mediaItemStateByTvdb?: GqlMediaItemStateTree | null;
            }>(request.query, request.variables);
            applyLiveState(payload[request.resultKey]);
        } catch {
            // non-critical, ignore
        } finally {
            rivenPending = false;
        }
    }

    $effect(() => {
        if (!browser) {
            return;
        }

        const subscription = getLiveRivenSubscription();

        if (!subscription) {
            rivenPending = false;
            return;
        }

        const unsubscribe = gqlSubscribeClient<{
            mediaItemStateUpdatesByTmdb?: GqlMediaItemStateTree | null;
            mediaItemStateUpdatesByTvdb?: GqlMediaItemStateTree | null;
        }>(subscription.query, subscription.variables, {
            onData: (payload) => {
                applyLiveState(payload[subscription.resultKey]);
                rivenPending = false;
            },
            onError: () => {
                void hydrateInitialState();
            }
        });

        return unsubscribe;
    });

    $effect(() => {
        if (!browser || !needsCompletedDetailsHydration(riven)) {
            return;
        }

        void hydrateCompletedDetails();
    });

    $effect(() => {
        if (!browser || !rawDataOpen) {
            return;
        }

        void fetchRawRivenData();
    });

    // When the current show gets indexed (via background queue or indexShow mutation),
    // hydrate the Riven state so the page reflects the transition without a manual refresh.
    $effect(() => {
        if (!browser || data.mediaDetails?.type !== "tv" || !data.resolvedTvdbId) return;

        const targetTvdbId = data.resolvedTvdbId.toString();

        return gqlSubscribeClient<{ showIndexed: GqlIndexedShow }>(
            SHOW_INDEXED_SUBSCRIPTION,
            undefined,
            {
                onData: (payload) => {
                    const indexed = payload.showIndexed;
                    if (indexed?.tvdbId !== targetTvdbId) return;

                    if (!liveRivenItemId) {
                        liveRivenItemId = indexed.id;
                    }
                    void hydrateInitialState();
                },
                onError: () => {
                    void hydrateInitialState();
                }
            }
        );
    });
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -->

{#snippet mediaCarousel(
    items: Array<{
        id: number;
        title: string;
        poster_path: string | null;
        media_type: string;
        year?: number | string | null;
    }>,
    title: string,
    delay: number = 600
)}
    <section
        class="mt-8 md:mt-12"
        in:fly|global={{ y: 20, duration: 400, delay, easing: cubicOut }}>
        <SectionHeading {title} />
        <Carousel.Root opts={{ dragFree: true, slidesToScroll: "auto" }}>
            <Carousel.Content class="-ml-3">
                {#each items as item (`${item.media_type}-${item.id}`)}
                    <Carousel.Item class="basis-auto pl-3">
                        <a
                            href={mediaHref(item.id, item.media_type)}
                            class="group relative block opacity-80 transition-all duration-300 hover:opacity-100">
                            <PortraitCard
                                title={item.title}
                                subtitle={`${item.media_type === "tv" ? "TV" : "Movie"}${item.year ? ` • ${item.year}` : ""}`}
                                image={item.poster_path}
                                class="w-36 md:w-44 lg:w-48" />
                        </a>
                    </Carousel.Item>
                {/each}
            </Carousel.Content>
        </Carousel.Root>
    </section>
{/snippet}

<svelte:head>
    <title>{data.mediaDetails?.details.title} ({data.mediaDetails?.details.year}) - Riven</title>
</svelte:head>

{#key data.mediaDetails?.details.id}
    <div class="relative flex min-h-screen flex-col overflow-x-hidden">
        {#if data.mediaDetails?.details.backdrop_path}
            <BackdropBackground>
                {#snippet image()}
                    <img
                        alt=""
                        in:fade={{ duration: 1000, easing: cubicOut }}
                        class="h-full w-full object-cover opacity-30 blur-3xl transition-opacity duration-1000"
                        src={data.mediaDetails?.details.backdrop_path}
                        loading="lazy" />
                {/snippet}
            </BackdropBackground>
        {/if}

        <div class="z-10 mx-auto flex h-full w-full max-w-600 flex-col">
            <!-- Hero Banner - extends behind search bar -->
            <HeroBanner
                backdropPath={data.mediaDetails?.details.backdrop_path}
                logo={data.mediaDetails?.details.logo}
                trailer={data.mediaDetails?.details.trailer} />

            <!-- Rest of content with padding -->
            <div class="px-8 pb-24 md:px-20 lg:px-24">
                <div class="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr] lg:gap-6">
                    <!-- Poster Column -->
                    <div
                        class="hidden lg:mx-0 lg:block"
                        in:fly|global={{ y: 20, duration: 400, delay: 50, easing: cubicOut }}>
                        <PortraitCard
                            title={data.mediaDetails?.details.title ?? ""}
                            image={data.mediaDetails?.details.poster_path ||
                                "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg"}
                            class="group w-48 rounded-xl shadow-2xl lg:w-64"
                            showContent={false} />
                    </div>

                    <!-- Content Column -->
                    <div class="flex flex-col gap-5">
                        <!-- Title + Status Row -->
                        <div
                            class="flex flex-wrap items-center gap-3"
                            in:fly|global={{ y: 20, duration: 400, delay: 100, easing: cubicOut }}>
                            <h1
                                class="text-foreground text-3xl font-black tracking-tight drop-shadow-md sm:text-4xl lg:text-5xl">
                                {data.mediaDetails?.details.title}
                            </h1>
                            {#if riven?.state}
                                <StatusBadge
                                    class="px-3 py-1.5 text-sm font-medium"
                                    state={riven.state} />
                            {/if}
                            {#if totalFileCount > 0}
                                <span
                                    class="text-muted-foreground border-border rounded-full border px-3 py-1.5 text-sm font-medium tabular-nums">
                                    {completedFileCount}/{totalFileCount} files
                                </span>
                            {/if}
                        </div>

                        <!-- Actions - Right under title -->
                        <ItemActionToolbar
                            title={data.mediaDetails?.details.title}
                            mediaType={data.mediaDetails?.type}
                            externalId={data.mediaDetails?.details?.id != null
                                ? data.mediaDetails.details.id.toString()
                                : null}
                            seasons={seasonData}
                            {riven}
                            {rivenId}
                            {rivenPending}
                            onRequestSuccess={handleRequestSuccess}
                            onActionSuccess={hydrateInitialState}
                            bind:rawDataOpen
                            {rawRivenLoading}
                            {rawRivenError}
                            {rawRivenJson} />

                        <!-- Metadata -->
                        <div
                            class="text-muted-foreground flex items-center gap-x-2.5 text-sm"
                            in:fly|global={{ y: 20, duration: 400, delay: 200, easing: cubicOut }}>
                            {#each details as detail, i (i)}
                                <span>{detail}</span>
                                {#if i < details.length - 1}<span class="text-border">•</span>{/if}
                            {/each}
                        </div>

                        <!-- Genres -->
                        {#if data.mediaDetails?.details.genres?.length}
                            <div
                                class="flex flex-wrap items-center gap-2"
                                in:fly|global={{
                                    y: 20,
                                    duration: 400,
                                    delay: 250,
                                    easing: cubicOut
                                }}>
                                {#each data.mediaDetails?.details.genres as genre (genre.id)}
                                    <span
                                        class="border-border bg-muted/50 text-muted-foreground rounded-xl border px-3 py-1 text-sm"
                                        >{genre.name}</span>
                                {/each}
                            </div>
                        {/if}

                        <!-- Ratings -->
                        <RatingsRow scores={ratingsData?.scores} loading={ratingsLoading} />

                        <!-- Description -->
                        <p
                            class="text-muted-foreground max-w-4xl text-base leading-relaxed"
                            in:fly|global={{ y: 20, duration: 400, delay: 350, easing: cubicOut }}>
                            {data.mediaDetails?.details.overview}
                        </p>
                    </div>
                </div>

                {#if data.mediaDetails?.type === "movie"}
                    {@const movieDetails = data.mediaDetails.details}
                    {#if movieDetails.collection}
                        <section
                            class="mt-8 md:mt-12"
                            in:fly|global={{ y: 20, duration: 400, delay: 400, easing: cubicOut }}>
                            <SectionHeading title="Collection" />
                            <CollectionSheet
                                collectionId={movieDetails.collection.id}
                                collectionName={movieDetails.collection.name}
                                onRequested={handleRequestSuccess}>
                                {#snippet trigger({ props })}
                                    <button
                                        {...props}
                                        class="group border-border/50 relative block min-h-24 w-full overflow-hidden rounded-xl border text-left shadow-lg transition-all duration-300 md:min-h-36">
                                        <!-- Background Layer -->
                                        <div class="absolute inset-0">
                                            <img
                                                alt={movieDetails.collection?.name}
                                                class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                src={movieDetails.collection?.backdrop_path}
                                                loading="lazy" />
                                            <div
                                                class="from-background/90 via-background/40 absolute inset-0 bg-linear-to-r to-transparent">
                                            </div>
                                        </div>

                                        <!-- Content Layer -->
                                        <div
                                            class="relative flex flex-col justify-center p-4 md:p-8">
                                            <span
                                                class="text-foreground text-xl font-black drop-shadow-lg md:text-3xl"
                                                >{movieDetails.collection?.name}</span>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                class="border-border text-muted-foreground hover:bg-muted hover:text-foreground mt-3 w-fit border bg-transparent backdrop-blur-md"
                                                >View</Button>
                                        </div>
                                    </button>
                                {/snippet}
                            </CollectionSheet>
                        </section>
                    {/if}
                {/if}

                {#if data.mediaDetails?.type === "tv" && data.mediaDetails?.details.seasons}
                    <section
                        class="mt-8 md:mt-12"
                        in:fly|global={{ y: 20, duration: 400, delay: 450, easing: cubicOut }}>
                        <SectionHeading title="Seasons" />
                        <LiveSeasons
                            seasons={data.mediaDetails.details.seasons}
                            {selectedSeason}
                            stateBySeasonNumber={rivenSeasonsByNumber}
                            {episodeCountBySeasonNumber}
                            onSelectSeason={(season) => (selectedSeason = season)} />
                    </section>
                {/if}

                {#if data.mediaDetails?.type === "tv" && data.mediaDetails?.details.episodes}
                    <section
                        class="mt-8 md:mt-12"
                        in:fly|global={{ y: 20, duration: 400, delay: 500, easing: cubicOut }}>
                        <SectionHeading title="Episodes" />
                        <LiveEpisodes
                            episodes={data.mediaDetails.details.episodes}
                            {selectedSeason}
                            {selectedEpisode}
                            showTitle={data.mediaDetails.details.title}
                            stateByEpisodeNumber={selectedRivenEpisodesByNumber}
                            detailsByEpisodeNumber={selectedHydratedEpisodesByNumber}
                            {formatSize}
                            onDeleteFilesystemEntry={deleteFilesystemEntry} />
                    </section>
                {/if}

                <!-- Cast -->
                {#if data.mediaDetails?.details.cast?.length}
                    <section
                        class="mt-8 md:mt-12"
                        in:fly|global={{ y: 20, duration: 400, delay: 550, easing: cubicOut }}>
                        <SectionHeading title="Cast" />
                        <Carousel.Root opts={{ dragFree: true, slidesToScroll: "auto" }}>
                            <Carousel.Content class="-ml-3">
                                {#each data.mediaDetails.details.cast as member, i (i)}
                                    <Carousel.Item class="basis-auto pl-3">
                                        <a
                                            href={entityHref(
                                                member.id,
                                                "person",
                                                member.external_source === "tvdb"
                                                    ? "indexer=tvdb"
                                                    : undefined
                                            )}
                                            class="group relative block opacity-80 transition-all duration-300 hover:opacity-100">
                                            <PortraitCard
                                                title={member.name}
                                                subtitle={member.character}
                                                image={member.profile_path}
                                                class="w-32 md:w-36 lg:w-40" />
                                        </a>
                                    </Carousel.Item>
                                {/each}
                            </Carousel.Content>
                        </Carousel.Root>
                    </section>
                {/if}

                <!-- Details Section - Side by Side -->
                <section
                    class="mt-8 md:mt-12"
                    in:fly|global={{ y: 20, duration: 400, delay: 600, easing: cubicOut }}>
                    <div class="flex max-w-7xl flex-col gap-8 lg:flex-row lg:gap-12">
                        <MoreDetailsPanel
                            budget={data.mediaDetails?.type === "movie"
                                ? data.mediaDetails.details.budget
                                : undefined}
                            revenue={data.mediaDetails?.type === "movie"
                                ? data.mediaDetails.details.revenue
                                : undefined}
                            originCountry={data.mediaDetails?.details.origin_country}
                            spokenLanguages={data.mediaDetails?.details.spoken_languages}
                            productionCompanies={data.mediaDetails?.details.production_companies}
                            homepage={data.mediaDetails?.details.homepage}
                            imdbId={data.mediaDetails?.details.imdb_id}
                            {externalLinks} />

                        {#if riven && data.mediaDetails?.type === "movie" && movieFileEntries.length > 0}
                            <FileInformationPanel
                                entries={movieFileEntries}
                                fallbackMediaMetadata={riven?.media_metadata}
                                bind:selectedIndex={selectedMovieVersionIdx}
                                onDeleteEntry={deleteFilesystemEntry} />
                        {/if}
                    </div>
                </section>

                {#if data.mediaDetails?.details.recommendations?.length}{@render mediaCarousel(
                        data.mediaDetails.details.recommendations,
                        "Recommendations",
                        600
                    )}{/if}
                {#if data.mediaDetails?.details.similar?.length}{@render mediaCarousel(
                        data.mediaDetails.details.similar,
                        "Similar",
                        650
                    )}{/if}
                {#if data.mediaDetails?.details.trakt_recommendations?.length}{@render mediaCarousel(
                        data.mediaDetails.details.trakt_recommendations,
                        "More Like This",
                        700
                    )}{/if}
            </div>
        </div>
    </div>
{/key}

<!-- eslint-enable svelte/no-navigation-without-resolve -->
