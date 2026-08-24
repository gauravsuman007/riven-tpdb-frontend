<script lang="ts">
    import type { ActionData, PageData } from "./$types";
    import { Form, Field, HiddenIdPrefixInput, setFormContext, setValue } from "@sjsf/form";
    import { page } from "$app/state";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "$lib/components/settings/form-defaults";
    import IndexerPicker from "$lib/components/settings/indexer-picker.svelte";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import PageShell from "$lib/components/page-shell.svelte";
    import { cn } from "$lib/utils";
    import { buildSecretUiSchema } from "$lib/components/settings/secret-ui-schema";
    import { Button } from "$lib/components/ui/button/index.js";
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import CheckIcon from "@lucide/svelte/icons/check";
    import SaveIcon from "@lucide/svelte/icons/save";

    setShadcnContext();

    let { data }: { data: PageData } = $props();

    const meta = createMeta<ActionData, PageData>().form;

    // Credential fields render masked; see secret-ui-schema.ts. Exposed as a
    // getter so the form reads it lazily rather than capturing the first value.
    const uiSchema = $derived(buildSecretUiSchema((data as any)?.form?.initialValue));

    // "saving" while the request is in flight, "saved" briefly afterwards. The
    // button is the only place a save is visible, so it has to say all three
    // states -- previously it said "Submit" throughout and a save that worked
    // looked identical to one that never fired.
    let saveState = $state<"idle" | "saving" | "saved">("idle");
    let savedTimer: ReturnType<typeof setTimeout> | undefined;

    function settle(next: "idle" | "saved") {
        clearTimeout(savedTimer);
        saveState = next;

        if (next === "saved") {
            savedTimer = setTimeout(() => (saveState = "idle"), 2500);
        }
    }

    // @ts-expect-error - Schema is provided by page data
    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        get uiSchema() {
            return uiSchema;
        },
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        // On success the SvelteKit integration calls HTMLFormElement.reset().
        // Svelte 5 currently re-applies its bindings on the reset event, so
        // this is not today's bug -- measured, not assumed. It is still wrong
        // for this form: it is a view of stored settings, not an entry form to
        // be emptied after submitting, and relying on that Svelte behaviour to
        // save us is not something to leave to chance.
        reset: false,
        onSuccess: (result) => {
            if (result.type === "success") {
                // Snap every control back to what the backend actually stored.
                //
                // The integration calls invalidateAll() before this runs, so
                // `page.data` is already refreshed -- but the form captures its
                // initial value once at setup and never re-reads it, so the
                // widgets can drift from the saved settings and stay drifted
                // until a manual reload. This makes the stored value the single
                // source of truth after every save, whatever the controls were
                // showing a moment earlier.
                const stored = (page.data as any)?.form?.initialValue;

                if (stored) setValue(form, structuredClone(stored));

                settle("saved");
                toast.success("Settings saved");
            } else {
                settle("idle");
                // Name the fields that blocked the save. A rejected save
                // restores the form to the submitted value, which on its own
                // looks indistinguishable from a save that silently undid
                // itself -- the user needs to know *what* to fix and on which
                // tab, not just that something went wrong.
                const errors = (result as any)?.data?.form?.errors ?? [];
                const described = errors
                    .slice(0, 3)
                    .map((e: any) => `${(e.path ?? []).join(".") || "form"}: ${e.message}`);

                toast.error(errors.length ? "Settings not saved" : "Failed to save settings", {
                    description: described.length
                        ? described.join("\n") +
                          (errors.length > described.length
                              ? `\n...and ${errors.length - described.length} more`
                              : "")
                        : undefined,
                    duration: 8000
                });
            }
        },
        onFailure: () => {
            settle("idle");
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

    /**
     * Any top-level schema key not claimed by a tab above still has to render,
     * or saving would drop it. Rather than trusting the list to stay in step
     * with the backend, anything unclaimed is collected into a final tab.
     */
    const extraSections = $derived.by(() => {
        const schema = (data as any)?.form?.schema;
        const keys: string[] = Object.keys(schema?.properties ?? {});
        const claimed = new Set(TABS.flatMap((tab) => tab.sections as readonly string[]));
        return keys.filter((key) => !claimed.has(key));
    });

    const tabs = $derived(
        extraSections.length > 0
            ? [...TABS, { id: "other", label: "Other", sections: extraSections }]
            : [...TABS]
    );

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
            {#each tabs as tab (tab.id)}
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
            <!--
                `onSubmit` is not available here: the SvelteKit integration
                reserves it. The native submit event fires first either way,
                which is all the button needs to show progress.
            -->
            <Form
                attributes={{
                    method: "POST",
                    onsubmit: () => {
                        saveState = "saving";
                    }
                }}>
                <!-- Carries the id prefix the server needs to parse the
                     submitted FormData; BasicForm renders this internally. -->
                <HiddenIdPrefixInput {form} />

                {#each tabs as tab (tab.id)}
                    <div
                        id="settings-panel-{tab.id}"
                        role="tabpanel"
                        class={cn("flex-col gap-8", active === tab.id ? "flex" : "hidden")}>
                        <!--
                            The generated form renders indexer_ids as a bare
                            array of integers, which is unusable without
                            knowing Prowlarr's ids. The picker sits alongside
                            it and writes the same setting.
                        -->
                        {#if tab.id === "scraping"}
                            <div
                                class="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                                <div class="min-w-0">
                                    <p class="text-sm font-medium">Prowlarr indexers</p>
                                    <p class="text-muted-foreground text-xs">
                                        Restrict searches to specific indexers. Scrapes wait for the
                                        slowest one.
                                    </p>
                                </div>
                                <IndexerPicker />
                            </div>
                        {/if}

                        {#each tab.sections as section (section)}
                            <!-- The schema is fetched from the backend at
                                 runtime, so section names cannot be checked
                                 against a literal union at compile time. -->
                            <Field {form} path={[section] as never} />
                        {/each}
                    </div>
                {/each}

                <div
                    class="border-border/60 bg-background/80 sticky bottom-0 mt-8 flex items-center gap-3 border-t py-4 backdrop-blur-md">
                    <Button type="submit" disabled={saveState === "saving"} class="min-w-32">
                        {#if saveState === "saving"}
                            <LoaderIcon class="mr-2 size-4 animate-spin" />
                            Saving
                        {:else if saveState === "saved"}
                            <CheckIcon class="mr-2 size-4" />
                            Saved
                        {:else}
                            <SaveIcon class="mr-2 size-4" />
                            Save
                        {/if}
                    </Button>
                    <p class="text-muted-foreground text-xs">
                        Saves every tab, not just the one on screen.
                    </p>
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
