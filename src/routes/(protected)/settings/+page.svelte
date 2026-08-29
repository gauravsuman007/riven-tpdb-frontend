<script lang="ts">
    import type { ActionData, PageData } from "./$types";
    import {
        Form,
        Field,
        HiddenIdPrefixInput,
        setFormContext,
        setValue,
        getValueSnapshot
    } from "@sjsf/form";
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
    import LoaderIcon from "@lucide/svelte/icons/loader-circle";
    import CheckIcon from "@lucide/svelte/icons/check";
    import SaveIcon from "@lucide/svelte/icons/save";
    import VpnControl from "$lib/components/settings/vpn-control.svelte";
    import PluginControl from "$lib/components/settings/plugin-control.svelte";
    import NativeClientControl from "$lib/components/settings/native-client-control.svelte";

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
    let justSaved = $state(false);
    let savedTimer: ReturnType<typeof setTimeout> | undefined;

    function settle(next: boolean) {
        clearTimeout(savedTimer);
        justSaved = next;

        if (next) {
            savedTimer = setTimeout(() => (justSaved = false), 2500);
        }
    }

    // @ts-expect-error - Schema is provided by page data
    const { form, request } = setupSvelteKitForm(meta, {
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
        /*
            Deliberately NOT invalidating every load function on the site
            after a save.

            The integration's default is invalidateAll(), which re-runs EVERY
            page's load. That call sits outside the request task's own
            try/catch, so if any one of them fails -- a slow backend, a
            transient error on a page unrelated to settings -- the task
            rejects and `onFailure` reports "something went wrong while
            saving" for a save that already succeeded. That is the reported
            bug: the settings were written and the UI said they were not.

            The response already carries what the server validated and
            stored, so nothing here needs the refetch.
        */
        invalidateAll: false,
        onSuccess: (result) => {
            if (result.type === "success") {
                // Snap every control back to what the backend actually stored.
                //
                // Taken from the RESPONSE rather than `page.data`: with
                // invalidateAll off, page.data still holds the value from the
                // last full load, and the form captures its initial value
                // once at setup and never re-reads it. The action returns the
                // validated result, which is the authoritative "what is now
                // stored".
                const stored =
                    (result as any)?.data?.form?.data ??
                    (page.data as any)?.form?.initialValue;

                if (stored) setValue(form, structuredClone(stored));

                settle(true);
                // Re-baseline against what the backend actually stored, so
                // the watcher below does not immediately see the server's own
                // normalisation as a fresh edit and save in a loop.
                baseline = snapshot();
            } else {
                settle(false);
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
        onFailure: (error: unknown) => {
            settle(false);

            /*
                Reached only when the request task itself threw, which now
                means the response could not be parsed or the network dropped
                -- not that the server rejected the settings, which arrives
                through onSuccess with a failure result above.

                The message says what is actually known and the real error is
                logged, because the previous wording ("something went wrong")
                described every possible cause equally and made the one real
                report of it impossible to diagnose from.
            */
            console.error("[settings] save request failed:", error);
            toast.error("Could not reach the server to save settings", {
                description: "Your changes are still in the form -- try again.",
                duration: 8000
            });
        }
    });

    // "Saving" comes from the integration's own request task rather than a
    // submit listener: the form's `attributes` are spread onto the <form>
    // element, so adding an `onsubmit` there overrides the handler that
    // enhances the submission and silently drops the form back to a native
    // POST.
    const saveState = $derived(request.isProcessed ? "saving" : justSaved ? "saved" : "idle");

    setFormContext(form);

    /**
     * Autosave.
     *
     * There is no Save button: every field commits on its own, a short pause
     * after the last edit. Three things make that safe rather than a save
     * loop:
     *
     *  - the baseline is taken from the form's OWN first snapshot, not from
     *    `initialValue`. The schema applies defaults on mount, so those two
     *    differ, and baselining on `initialValue` would post the defaults
     *    over your stored settings the moment the page loaded.
     *  - after each save the baseline is retaken from the stored value, so
     *    the backend normalising what it received (coercing a number, adding
     *    a default) does not read back as a new edit.
     *  - saves never overlap: while one is in flight the watcher waits, and
     *    the debounce restarts, so a burst of typing is one request.
     *
     * The submit path itself is unchanged -- this calls `requestSubmit()` on
     * the real <form>, so the integration's own enhanced handler still runs.
     * Calling anything else would drop the form to a native POST, which the
     * server parses down a different branch (see the comment on `<Form>`).
     */
    const AUTOSAVE_DEBOUNCE_MS = 900;

    let formHost = $state<HTMLElement | undefined>();
    let baseline: string | undefined;
    let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

    function snapshot(): string | undefined {
        try {
            return JSON.stringify(getValueSnapshot(form));
        } catch {
            // A snapshot that cannot be serialised is not a reason to break
            // the page; it only means this edit is not autosaved.
            return undefined;
        }
    }

    $effect(() => {
        const current = snapshot();

        if (current === undefined) return;

        // First run: adopt whatever the form settled on as "already saved".
        if (baseline === undefined) {
            baseline = current;
            return;
        }

        if (current === baseline) return;

        // Let the in-flight save finish and re-baseline; this effect re-runs
        // when it does.
        if (request.isProcessed) return;

        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(() => {
            const form_ = formHost?.querySelector("form");

            if (form_) form_.requestSubmit();
        }, AUTOSAVE_DEBOUNCE_MS);

        return () => clearTimeout(autosaveTimer);
    });

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
        { id: "tpdb", label: "TPDB", sections: ["tpdb", "indexer"] },
        // Its own tab rather than a sub-section of TPDB. `content` holds the
        // brochure, the AVN corpus, user collections and the TPDB
        // subscriptions -- four independent things, and pages elsewhere point
        // users at "Settings -> Content", which was a dead end while it was
        // buried under TPDB.
        { id: "content", label: "Content", sections: ["content"] },
        { id: "scraping", label: "Scraping", sections: ["scraping", "ranking"] },
        { id: "downloaders", label: "Downloaders", sections: ["downloaders"] },
        // `jellyfin_server` sits beside `updaters` deliberately: they are the
        // two directions of the same integration. `updaters` tells a real
        // media server to rescan; `jellyfin_server` makes Riven be the
        // server instead, which is the one that works on a debrid library.
        {
            id: "library",
            label: "Library",
            sections: ["filesystem", "stream", "updaters", "jellyfin_server"]
        },
        { id: "post", label: "Post-processing", sections: ["post_processing"] },
        // Its own tab rather than falling through to "Other". The schema
        // fields below are only half of it -- logging in and picking an exit
        // node are live actions against the daemon, so this tab also carries
        // the control panel above the form.
        { id: "vpn", label: "VPN", sections: ["vpn"] },
        // Its own tab, not a sub-section of Scraping: enabling/disabling a
        // scraper is a live toggle against the plugin registry, same reason
        // the VPN tab carries a control panel alongside its generated form.
        { id: "plugins", label: "Plugins", sections: ["direct_scraping"] }
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

        <div class="settings-form" bind:this={formHost}>
            <!--
                Nothing but `method` goes in `attributes`. These are spread
                onto the <form> element and would override the integration's
                own `onsubmit`, which is what calls preventDefault and posts
                the form value as JSON. Overriding it makes the browser submit
                natively instead: the flat root.* fields get posted, the server
                takes a parser branch the enhanced path never uses, and the
                save fails with a full page reload that looks exactly like the
                form quietly resetting itself.
            -->
            <Form attributes={{ method: "POST" }}>
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
                        <!--
                            Logging in and choosing an exit node are actions
                            against a running daemon, not values to save, so
                            the generated form cannot express them.
                        -->
                        {#if tab.id === "vpn"}
                            <VpnControl />
                        {/if}

                        {#if tab.id === "plugins"}
                            <PluginControl />
                        {/if}

                        <!-- Renders only inside the Jellyfin WebView shell. -->
                        {#if tab.id === "general"}
                            <NativeClientControl />
                        {/if}

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

                <!--
                    Status, not a control: there is nothing to press. It stays
                    sticky because "did that save?" is the question this bar
                    exists to answer, and an indicator you have to scroll to
                    find does not answer it.
                -->
                <div
                    class="border-border/60 bg-background/80 text-muted-foreground sticky bottom-0 mt-8 flex items-center gap-2 border-t py-4 text-xs backdrop-blur-md"
                    aria-live="polite">
                    {#if saveState === "saving"}
                        <LoaderIcon class="size-3.5 animate-spin" />
                        Saving changes
                    {:else if saveState === "saved"}
                        <CheckIcon class="size-3.5 text-emerald-500" />
                        All changes saved
                    {:else}
                        <SaveIcon class="size-3.5" />
                        Changes save automatically, across every tab
                    {/if}
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
