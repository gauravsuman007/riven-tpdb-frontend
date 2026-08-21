<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Textarea from "./textarea.svelte";

    const { Story } = defineMeta({
        title: "ui/Textarea",
        component: Textarea,
        tags: ["autodocs"],
        args: {
            placeholder: "Type your message here."
        }
    });
</script>

<Story name="Default" args={{ class: "w-80" }} />

<Story name="Disabled" args={{ class: "w-80", disabled: true }} />

<Story name="WithValue" args={{ class: "w-80", value: "This is some existing text content." }} />
