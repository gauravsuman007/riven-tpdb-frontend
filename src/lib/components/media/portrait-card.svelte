<script lang="ts">
    import Mountain from "@lucide/svelte/icons/mountain";
    import PosterImage from "$lib/components/media/poster-image.svelte";
    import Check from "@lucide/svelte/icons/check";
    import { cn } from "$lib/utils";
    import Play from "@lucide/svelte/icons/play";
    import RatingBadge from "$lib/components/media/rating-badge.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        title: string;
        subtitle?: string | null;
        image: string | null;
        selected?: boolean;
        isSelectable?: boolean;
        isSelected?: boolean;
        onSelectToggle?: () => void;
        class?: string;
        topRight?: Snippet;
        /**
         * The title block under the poster. `false` leaves the bare artwork,
         * which is what the detail pages want -- they already print the title
         * beside it.
         */
        showContent?: boolean;
        /**
         * Audience rating out of five. Absent and zero both render nothing;
         * see `rating-badge.svelte` for why zero is not a score.
         */
        rating?: number | null;
        /** When set, a play affordance is drawn over the poster. */
        onPlay?: () => void;
        /**
         * Tailwind background class for the state bar along the bottom edge,
         * e.g. `describeState(item.state).barColor`. Omitted entirely when
         * there is no state to show, rather than falling back to a color --
         * a bar that is always present would stop meaning anything.
         */
        stateColor?: string | null;
    }

    let {
        title,
        subtitle = null,
        image,
        selected = false,
        isSelectable = false,
        isSelected = false,
        onSelectToggle,
        class: className,
        topRight,
        showContent = true,
        rating = null,
        onPlay,
        stateColor = null
    }: Props = $props();
</script>

<!--
    Poster on top, title underneath.

    The title used to be printed over the bottom of the artwork behind a
    gradient. That is legible but it costs the bottom third of every poster and
    it caps what the card can say: a second line of metadata over a photograph
    is unreadable at this size, so the rating had nowhere to go. Below the
    poster the artwork is whole and the text has room.
-->
<div class={cn("group flex w-full flex-col gap-2", className)}>
    <div
        class={cn(
            "bg-card ring-border hover:ring-primary/30 relative aspect-[2/3] w-full overflow-hidden rounded-xl shadow-sm ring-1 transition-all duration-500 hover:shadow-2xl hover:shadow-black/50",
            isSelected && "ring-primary shadow-[0_0_30px_rgba(var(--primary),0.3)] ring-2"
        )}>
        <!-- Background / Image -->
        {#if image}
            <PosterImage
                alt={title}
                src={image}
                class={cn(
                    "transition-transform duration-700 ease-out will-change-transform group-hover:scale-110",
                    isSelected ? "scale-105 opacity-40 grayscale-[0.5]" : "opacity-100"
                )} />
            <!--
            A light bottom fade only. The heavy from-black/90 gradient existed
            to make overlaid text readable; the text now sits below the poster,
            so keeping it would darken a third of every image for nothing.
        -->
            <div
                class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-30">
            </div>
            <!-- Subtle Theme Tint at the bottom -->
            <div
                class="from-primary/20 absolute inset-0 bg-gradient-to-t via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            </div>
        {:else}
            <div
                class="bg-muted text-muted-foreground flex h-full w-full items-center justify-center">
                <Mountain size={32} strokeWidth={1} />
            </div>
        {/if}

        <!--
        Play affordance. Sits above the poster but below the content, and
        stops propagation because the whole card is usually wrapped in a link
        to the detail page -- a play tap must not also navigate.
    -->
        {#if onPlay}
            <button
                type="button"
                onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPlay?.();
                }}
                aria-label={`Play ${title}`}
                class="absolute inset-0 z-20 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 focus-visible:opacity-100">
                <span
                    class="flex size-12 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur transition-transform duration-300 hover:scale-110">
                    <Play class="ml-0.5 size-6 fill-current" />
                </span>
            </button>
        {/if}

        <!-- Selection Overlay -->
        {#if isSelectable}
            <button
                onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectToggle?.();
                }}
                class={cn(
                    "absolute top-3 left-3 z-30 flex h-6 w-6 items-center justify-center rounded-full border transition-all duration-200",
                    isSelected
                        ? "border-primary bg-primary text-primary-foreground scale-110"
                        : "border-white/30 bg-black/20 opacity-0 group-hover:opacity-100 hover:border-white/50 hover:bg-black/40"
                )}
                aria-label="Select item">
                {#if isSelected}
                    <Check class="h-3 w-3" strokeWidth={3} />
                {/if}
            </button>
        {/if}

        <!-- Top Right Slot -->
        {#if topRight}
            <div
                class="absolute top-3 right-3 z-20 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                {@render topRight()}
            </div>
        {/if}

        <!-- State bar: a thin colored line at the poster's bottom edge, the same
         "state at a glance" idea a Whisparr-style poster strip uses. Above the
         content block in z-order so it stays visible under the text gradient. -->
        {#if stateColor}
            <div class={cn("absolute inset-x-0 bottom-0 z-20 h-1", stateColor)}></div>
        {/if}
    </div>

    <!-- Content -->
    {#if showContent}
        <div class="flex min-w-0 flex-col gap-0.5 px-0.5">
            <h3
                class="text-foreground group-hover:text-primary line-clamp-2 text-sm leading-tight font-semibold text-balance transition-colors">
                {title}
            </h3>
            {#if subtitle || rating}
                <p
                    class="text-muted-foreground flex min-w-0 items-center gap-2 text-xs font-medium">
                    <RatingBadge {rating} />
                    {#if subtitle}
                        <span class="truncate">{subtitle}</span>
                    {/if}
                </p>
            {/if}
        </div>
    {/if}
</div>
