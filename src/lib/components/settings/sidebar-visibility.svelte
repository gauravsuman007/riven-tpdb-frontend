<script lang="ts">
    /**
     * Which entries the sidebar shows, on the General settings tab.
     *
     * Not part of the schema-driven form above it, and for the same reason
     * the app PIN is not: that form is generated from the BACKEND's settings
     * schema, and this is a per-user frontend fact stored in the frontend's
     * own database. Same shape of control, same neighbourhood.
     *
     * HOME AND SETTINGS HAVE NO SWITCH. Hiding Settings would remove the only
     * route back to this control, so the sidebar could not be repaired from
     * the UI at all. They are listed anyway, greyed, rather than left out --
     * a list that silently omits two of the entries on screen reads as a bug
     * in the list.
     */
    import { invalidateAll } from "$app/navigation";
    import { page } from "$app/state";
    import { toast } from "svelte-sonner";
    import PanelLeft from "@lucide/svelte/icons/panel-left";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import EyeOffIcon from "@lucide/svelte/icons/eye-off";
    import { navCatalogue } from "$lib/nav";
    import type { AddonNav } from "$lib/addons";

    /*
        The catalogue is derived from the same two sources the sidebar itself
        renders from -- the manifest and the layout's add-on nav -- so an
        add-on installed a moment ago is offerable here without a second
        endpoint that could disagree with what is on screen.
    */
    const catalogue = $derived(navCatalogue((page.data.addonNav ?? []) as AddonNav[]));

    /*
        Seeded from the layout's copy, which is what the sidebar is drawing
        right now, so the switches match the sidebar on first paint with no
        fetch. Held locally afterwards: a toggle must move the moment it is
        pressed, not a round trip later.
    */
    let hidden = $state<string[]>([...((page.data.navHidden ?? []) as string[])]);
    let busy = $state(false);

    async function toggle(key: string) {
        const next = hidden.includes(key)
            ? hidden.filter((entry) => entry !== key)
            : [...hidden, key];

        const previous = hidden;
        hidden = next;
        busy = true;

        try {
            const response = await fetch("/api/nav", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ hidden: next })
            });

            if (!response.ok) {
                // Put the switch back. A control that stays where you left it
                // while the server kept the old value is the one failure mode
                // worth spending a revert on.
                hidden = previous;
                toast.error("Could not save the sidebar layout");
                return;
            }

            hidden = (await response.json()).hidden ?? next;
            // The sidebar reads this from the layout's load, so it only
            // redraws once that has re-run.
            await invalidateAll();
        } catch {
            hidden = previous;
            toast.error("Could not save the sidebar layout");
        } finally {
            busy = false;
        }
    }
</script>

<section class="border-border/60 bg-card/60 flex flex-col gap-4 rounded-xl border p-5">
    <div class="flex items-start gap-3">
        <PanelLeft class="text-muted-foreground mt-0.5 size-5 shrink-0" />
        <div class="min-w-0">
            <h3 class="text-sm font-semibold">Sidebar</h3>
            <p class="text-muted-foreground text-xs">
                Choose which pages appear in the sidebar. Hiding one does not disable it -- the page
                still works if you have its address.
            </p>
        </div>
    </div>

    <ul class="flex flex-col gap-1">
        {#each catalogue as entry (entry.key)}
            {@const isHidden = hidden.includes(entry.key)}
            <li class="flex items-center justify-between gap-3 py-1">
                <span class="truncate text-sm {isHidden ? 'text-muted-foreground' : ''}">
                    {entry.label}
                </span>

                {#if entry.lockable}
                    <button
                        type="button"
                        disabled={busy}
                        onclick={() => toggle(entry.key)}
                        aria-pressed={!isHidden}
                        class="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50">
                        {#if isHidden}
                            <EyeOffIcon class="size-4" />
                            Hidden
                        {:else}
                            <EyeIcon class="size-4" />
                            Shown
                        {/if}
                    </button>
                {:else}
                    <span class="text-muted-foreground/70 px-2 py-1 text-xs">Always shown</span>
                {/if}
            </li>
        {/each}
    </ul>
</section>
