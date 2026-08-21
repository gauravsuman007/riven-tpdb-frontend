<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import { Toaster } from "./index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { toast } from "svelte-sonner";

    const { Story } = defineMeta({
        title: "ui/Sonner",
        component: Toaster,
        tags: ["autodocs"]
    });
</script>

<Story name="Default" asChild>
    <div>
        <Toaster />
        <div class="flex flex-wrap gap-2">
            <Button variant="outline" onclick={() => toast("Event has been created")}>
                Default
            </Button>
            <Button variant="outline" onclick={() => toast.success("Item saved successfully")}>
                Success
            </Button>
            <Button variant="outline" onclick={() => toast.error("Something went wrong")}>
                Error
            </Button>
            <Button variant="outline" onclick={() => toast.info("A new version is available")}>
                Info
            </Button>
            <Button variant="outline" onclick={() => toast.warning("Your session is expiring")}>
                Warning
            </Button>
        </div>
    </div>
</Story>
