<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LogTabButton from "./log-tab-button.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "logs/LogTabButton",
        component: LogTabButton,
        tags: ["autodocs"],
        args: {
            name: "Live Logs",
            onclick: fn()
        }
    });
</script>

<Story name="Inactive" args={{ isActive: false }} />

<Story name="Active" args={{ isActive: true }} />
