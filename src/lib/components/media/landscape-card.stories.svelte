<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LandscapeCard from "./landscape-card.svelte";

    const { Story } = defineMeta({
        title: "media/LandscapeCard",
        component: LandscapeCard,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "`tmdbId` is intentionally omitted in these stories to avoid a live ratings fetch — passing `initialRating` alone renders the static rating badge without triggering `getRatings()`."
                }
            }
        },
        args: {
            title: "John Wick: Chapter 4",
            image: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg",
            initialRating: 7.8
        }
    });
</script>

<Story name="Default" asChild>
    <div class="w-80">
        <LandscapeCard
            title="John Wick: Chapter 4"
            image="https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg"
            initialRating={7.8} />
    </div>
</Story>

<Story name="NoImage" asChild>
    <div class="w-80">
        <LandscapeCard title="Unknown Title" image={null} />
    </div>
</Story>

<Story name="WithOverview" asChild>
    <div class="w-80">
        <LandscapeCard
            title="Arcane"
            image="https://image.tmdb.org/t/p/w500/abVBNjmZm9lDprHUEGFQ0zN3ChD.jpg"
            overview="Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war."
            initialRating={9.1} />
    </div>
</Story>
