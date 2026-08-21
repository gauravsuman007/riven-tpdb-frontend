<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import ImmersiveBackground from "./immersive-background.svelte";

    const { Story } = defineMeta({
        title: "components/ImmersiveBackground",
        component: ImmersiveBackground,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<Story name="Default" asChild>
    <div class="relative h-96 w-full overflow-hidden">
        <ImmersiveBackground />
    </div>
</Story>
