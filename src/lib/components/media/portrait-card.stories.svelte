<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import PortraitCard from "./portrait-card.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "media/PortraitCard",
        component: PortraitCard,
        tags: ["autodocs"],
        args: {
            title: "John Wick: Chapter 4",
            image: "https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg"
        }
    });
</script>

<Story name="Default" asChild>
    <div class="w-48">
        <PortraitCard
            title="John Wick: Chapter 4"
            image="https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg" />
    </div>
</Story>

<Story name="NoImage" asChild>
    <div class="w-48">
        <PortraitCard title="Unknown Title" image={null} />
    </div>
</Story>

<Story name="WithSubtitle" asChild>
    <div class="w-48">
        <PortraitCard
            title="Arcane"
            subtitle="S2 · 9 Episodes"
            image="https://image.tmdb.org/t/p/w500/abVBNjmZm9lDprHUEGFQ0zN3ChD.jpg" />
    </div>
</Story>

<Story name="Selectable" asChild>
    <div class="w-48">
        <PortraitCard
            title="Dune: Part Two"
            image="https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg"
            isSelectable
            isSelected={false}
            onSelectToggle={fn()} />
    </div>
</Story>

<Story name="Selected" asChild>
    <div class="w-48">
        <PortraitCard
            title="Dune: Part Two"
            image="https://image.tmdb.org/t/p/w500/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg"
            isSelectable
            isSelected
            onSelectToggle={fn()} />
    </div>
</Story>

<Story name="NoContentOverlay" asChild>
    <div class="w-48">
        <PortraitCard
            title="Arcane"
            image="https://image.tmdb.org/t/p/w500/abVBNjmZm9lDprHUEGFQ0zN3ChD.jpg"
            showContent={false} />
    </div>
</Story>
