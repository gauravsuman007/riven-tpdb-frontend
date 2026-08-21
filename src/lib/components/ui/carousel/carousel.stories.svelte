<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import * as Carousel from "./index.js";

    const { Story } = defineMeta({
        title: "ui/Carousel",
        component: Carousel.Root,
        tags: ["autodocs"],
        parameters: {
            layout: "centered"
        }
    });
</script>

<Story name="Default" asChild>
    <Carousel.Root class="w-full max-w-xs">
        <Carousel.Content>
            {#each Array(5) as _, i (i)}
                <Carousel.Item>
                    <div
                        class="border-border bg-card flex aspect-square items-center justify-center rounded-lg border">
                        <span class="text-4xl font-semibold">{i + 1}</span>
                    </div>
                </Carousel.Item>
            {/each}
        </Carousel.Content>
        <Carousel.Previous />
        <Carousel.Next />
    </Carousel.Root>
</Story>
