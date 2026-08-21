<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import StatusBadge from "./status-badge.svelte";

    const { Story } = defineMeta({
        title: "media/StatusBadge",
        component: StatusBadge,
        tags: ["autodocs"],
        argTypes: {
            state: {
                control: "select",
                options: [
                    "Completed",
                    "PartiallyCompleted",
                    "Ongoing",
                    "Scraped",
                    "Indexed",
                    "Unreleased",
                    "Paused",
                    "Failed",
                    "Requested"
                ]
            },
            size: {
                control: "select",
                options: ["sm", "default"]
            }
        },
        args: {
            state: "Completed",
            size: "sm"
        }
    });
</script>

<Story name="Completed" />

<Story name="Ongoing" args={{ state: "Ongoing" }} />

<Story name="Failed" args={{ state: "Failed" }} />

<Story name="Unreleased" args={{ state: "Unreleased" }} />

<Story name="AllStates" asChild>
    <div class="flex flex-wrap gap-2">
        <StatusBadge state="Completed" />
        <StatusBadge state="PartiallyCompleted" />
        <StatusBadge state="Ongoing" />
        <StatusBadge state="Scraped" />
        <StatusBadge state="Indexed" />
        <StatusBadge state="Unreleased" />
        <StatusBadge state="Paused" />
        <StatusBadge state="Failed" />
    </div>
</Story>
