<script lang="ts">
    import { Button } from "$lib/components/ui/button/index.js";
    import Play from "@lucide/svelte/icons/play";
    import X from "@lucide/svelte/icons/x";
    import { cn } from "$lib/utils";
    import type { ParsedTrailer } from "$lib/metadata/parser.types";

    interface Props {
        backdropPath: string | null | undefined;
        logo: string | null | undefined;
        trailer: ParsedTrailer | null | undefined;
    }

    let { backdropPath, logo, trailer }: Props = $props();

    let showTrailerOverride = $state(false);
    const showTrailer = $derived(showTrailerOverride && trailer);
</script>

{#if backdropPath || trailer}
    <div class="px-2 md:px-4">
        <div
            class={cn(
                "relative mb-6 flex h-[40vh] max-h-150 min-h-87.5 items-end justify-between overflow-hidden rounded-3xl bg-cover bg-center shadow-2xl transition-all duration-500 md:mb-10",
                !showTrailer && "p-6 md:p-12"
            )}
            style="background-image: url('{backdropPath}');">
            <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-transparent">
            </div>
            <!-- Border Overlay to prevent bright edge glitch -->
            <div class="border-border/10 pointer-events-none absolute inset-0 rounded-2xl border">
            </div>

            {#if !showTrailer}
                <div class="relative z-10 flex w-full items-end justify-between">
                    {#if logo}
                        <img
                            alt="Logo"
                            class="max-h-16 max-w-[60%] object-contain drop-shadow-2xl md:max-h-28 lg:max-h-36"
                            src={logo}
                            loading="lazy" />
                    {:else}<div></div>{/if}

                    <div class="flex gap-2 md:gap-4">
                        {#if trailer}
                            <Button
                                variant="secondary"
                                size="sm"
                                class="border border-white/10 bg-white/10 px-6 text-sm font-bold text-white shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20"
                                onclick={() => (showTrailerOverride = !showTrailer)}>
                                <Play size={14} class="mr-2 fill-current" />Trailer
                            </Button>
                        {/if}
                    </div>
                </div>
            {:else}
                <iframe
                    class="absolute inset-0 h-full w-full"
                    src="https://www.youtube-nocookie.com/embed/{trailer?.key}?autoplay=1&controls=1&mute=0&rel=0&modestbranding=1&playsinline=1"
                    title="Trailer"
                    allow="autoplay"
                    allowfullscreen></iframe>
                <Button
                    variant="ghost"
                    size="icon"
                    class="bg-background/60 text-foreground hover:bg-background/80 absolute top-4 right-4 z-20"
                    onclick={() => (showTrailerOverride = false)}>
                    <X class="h-6 w-6" />
                </Button>
            {/if}
        </div>
    </div>
{/if}
