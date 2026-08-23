<script lang="ts">
    import type { ActionData, PageData } from "./$types";
    import {
        Form,
        Field,
        SubmitButton,
        HiddenIdPrefixInput,
        setFormContext
    } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "$lib/components/settings/form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import PageShell from "$lib/components/page-shell.svelte";
    import { cn } from "$lib/utils";

    setShadcnContext();

    const meta = createMeta<ActionData, PageData>().form;

    // @ts-expect-error - Schema is provided by page data
    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result) => {
            if (result.type === "success") {
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving settings");
        }
    });

    setFormContext(form);

    /**
     * Tabs are a presentation layer over one form: the schema still comes from
     * the backend, and each entry here is a top-level settings key.
     *
     * Inactive panels stay mounted and are hidden with CSS rather than removed
     * from the DOM. The server parses the submitted FormData, so a field that
     * is not rendered would be dropped from the payload -- switching tabs must
     * not silently discard the settings on the tabs you did not open.
     */
    const TABS = [
        {
            id: "general",
            label: "General",
            sections: [
                "version",
                "api_key",
                "log_level",
                "retry_interval",
                "database",
                "logging",
                "notifications",
                "enable_network_tracing",
                "enable_stream_tracing",
                "tracemalloc"
            ]
        },
        { id: "tpdb", label: "TPDB", sections: ["tpdb", "content", "indexer"] },
        { id: "scraping", label: "Scraping", sections: ["scraping", "ranking"] },
        { id: "downloaders", label: "Downloaders", sections: ["downloaders"] },
        { id: "library", label: "Library", sections: ["filesystem", "stream", "updaters"] },
        { id: "post", label: "Post-processing", sections: ["post_processing"] }
    ] as const;

    let active = $state<string>(TABS[0].id);
</script>

<svelte:head>
    <title>Settings - Riven TPDB</title>
</svelte:head>

<PageShell class="h-full">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24">
        <h1 class="text-foreground text-3xl font-black tracking-tight">Settings</h1>

        <div
            class="border-border/60 bg-background/60 sticky top-0 z-20 flex flex-wrap gap-1 border-b pb-2 backdrop-blur-md"
            role="tablist">
            {#each TABS as tab (tab.id)}
                <button
                    type="button"
                    role="tab"
                    aria-selected={active === tab.id}
                    aria-controls="settings-panel-{tab.id}"
                    onclick={() => (active = tab.id)}
                    class={cn(
                        "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                        active === tab.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}>
                    {tab.label}
                </button>
            {/each}
        </div>

        <div class="settings-form">
            <Form attributes={{ method: "POST" }}>
                <!-- Carries the id prefix the server needs to parse the
                     submitted FormData; BasicForm renders this internally. -->
                <HiddenIdPrefixInput {form} />

                {#each TABS as tab (tab.id)}
                    <div
                        id="settings-panel-{tab.id}"
                        role="tabpanel"
                        class={cn("flex-col gap-8", active === tab.id ? "flex" : "hidden")}>
                        {#each tab.sections as section (section)}
                            <Field {form} path={[section]} />
                        {/each}
                    </div>
                {/each}

                <div
                    class="border-border/60 bg-background/80 sticky bottom-0 mt-8 border-t py-4 backdrop-blur-md">
                    <SubmitButton />
                </div>
            </Form>
        </div>
    </div>
</PageShell>

<style>
    /*
     * Nested objects render as <fieldset>/<legend>. Giving each one a card
     * makes the boundary between sibling groups explicit -- Real-Debrid vs
     * Debrid-Link vs TorBox read as separate blocks rather than one long list.
     */
    .settings-form :global(fieldset) {
        border: 1px solid var(--border);
        border-radius: 0.75rem;
        padding: 1.25rem;
        background: color-mix(in oklab, var(--card) 60%, transparent);
    }

    .settings-form :global(legend) {
        padding-inline: 0.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
    }

    /* Nested groups sit inside an already-carded parent; stepping the tint
       keeps the nesting legible without adding another heavy border. */
    .settings-form :global(fieldset fieldset) {
        background: color-mix(in oklab, var(--muted) 35%, transparent);
        margin-block: 0.35rem;
    }

    .settings-form :global(fieldset fieldset fieldset) {
        background: transparent;
    }
</style>
