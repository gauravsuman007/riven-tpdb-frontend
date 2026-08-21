<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Input from "./input.svelte";

    const { Story } = defineMeta({
        title: "ui/Input",
        component: Input,
        tags: ["autodocs"],
        argTypes: {
            type: {
                control: "select",
                options: ["text", "email", "password", "number", "search"]
            },
            disabled: { control: "boolean" },
            placeholder: { control: "text" }
        },
        args: {
            type: "text",
            placeholder: "Email"
        }
    });
</script>

<Story name="Default" />

<Story name="Disabled" args={{ disabled: true }} />

<Story name="Password" args={{ type: "password", placeholder: "Password" }} />

<Story name="WithValue" args={{ value: "hello@example.com" }} />
