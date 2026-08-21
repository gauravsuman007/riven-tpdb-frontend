<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import BackdropBackground from "./backdrop-background.svelte";

    const { Story } = defineMeta({
        title: "media/BackdropBackground",
        component: BackdropBackground,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });

    const sampleImage = "https://image.tmdb.org/t/p/original/nAxGnGHOsfzufThz20zgmRwq0hy.jpg";
</script>

<Story name="Zinc" asChild>
    <div class="relative h-96 w-full overflow-hidden">
        <BackdropBackground tone="zinc">
            {#snippet image()}
                <img
                    alt=""
                    class="h-full w-full object-cover opacity-30 blur-3xl"
                    src={sampleImage} />
            {/snippet}
        </BackdropBackground>
    </div>
</Story>

<Story name="ThemeBackground" asChild>
    <div class="relative h-96 w-full overflow-hidden">
        <BackdropBackground tone="background">
            {#snippet image()}
                <img
                    alt=""
                    class="h-full w-full object-cover opacity-30 blur-3xl"
                    src={sampleImage} />
            {/snippet}
        </BackdropBackground>
    </div>
</Story>
