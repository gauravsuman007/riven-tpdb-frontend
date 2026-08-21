<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import { Calendar } from "./index.js";
    import { today, getLocalTimeZone } from "@internationalized/date";

    const { Story } = defineMeta({
        title: "ui/Calendar",
        component: Calendar,
        tags: ["autodocs"],
        argTypes: {
            captionLayout: {
                control: "select",
                options: ["label", "dropdown", "dropdown-months", "dropdown-years"]
            },
            weekdayFormat: {
                control: "select",
                options: ["narrow", "short", "long"]
            }
        },
        args: {
            value: today(getLocalTimeZone()),
            captionLayout: "label",
            weekdayFormat: "short"
        }
    });
</script>

<Story name="Default" />

<Story name="DropdownCaption" args={{ captionLayout: "dropdown" }} />
