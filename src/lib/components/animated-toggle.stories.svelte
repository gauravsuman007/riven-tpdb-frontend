<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import AnimatedToggle from "./animated-toggle.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "components/AnimatedToggle",
        component: AnimatedToggle,
        tags: ["autodocs"],
        args: {
            options: [
                { label: "Movies", value: "movie" },
                { label: "TV Shows", value: "tv" },
                { label: "Anime", value: "anime" }
            ],
            onchange: fn()
        }
    });
</script>

<Story name="Default" args={{ value: "movie" }} />

<Story name="SecondSelected" args={{ value: "tv" }} />
