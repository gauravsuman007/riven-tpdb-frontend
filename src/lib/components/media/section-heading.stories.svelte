<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import SectionHeading from "./section-heading.svelte";

    const { Story } = defineMeta({
        title: "media/SectionHeading",
        component: SectionHeading,
        tags: ["autodocs"],
        args: {
            title: "More Details"
        }
    });
</script>

<Story name="Default" />

<Story
    name="LongTitle"
    args={{ title: "A Much Longer Section Heading For Testing Wrap Behavior" }} />
