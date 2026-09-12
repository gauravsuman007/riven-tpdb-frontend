<script lang="ts">
    import { onDestroy } from "svelte";
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import { addonAsset } from "$lib/addons";
    import { hostBridge, type HostBridge } from "$lib/addon-host";
    import PageShell from "$lib/components/page-shell.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const key = $derived(page.params.addon ?? "");
    const rest = $derived(page.params.rest ?? "");

    let host = $state<HTMLDivElement | null>(null);
    let failure = $state<string | null>(null);

    /*
        THE ADD-ON'S PAGE IS NOT COMPILED INTO THIS APP.

        SvelteKit builds its routes ahead of time, so an add-on installed from
        a git URL could never contribute one -- which would make "install from
        a URL" mean "install half of it and rebuild the frontend for the rest".
        Instead the add-on ships an already-built ESM bundle, the backend serves
        it out of the add-on's folder, and this page imports it at runtime and
        hands it a DOM node.

        The bundle brings its OWN Svelte runtime rather than borrowing this
        one. Two runtimes in one document are only a problem if they share a
        component tree, and this deliberately does not: the add-on gets a bare
        element and owns everything inside it. The alternative -- externalising
        Svelte and wiring an import map -- couples every add-on's build to this
        app's exact Svelte version for no benefit at this size.
    */
    type Mounted = { destroy?: () => void; update?: (path: string) => void };
    type MountFn = (context: {
        target: HTMLElement;
        path: string;
        /** Prefix for the add-on's own API. It never has to know the shape of
         *  the host's routing, only its own. */
        api: string;
        /** Host navigation, so a link inside the add-on keeps the SPA intact
         *  rather than reloading the whole application. */
        navigate: (to: string) => void;
        /*
            The same bridge a slot add-on is given.

            A page used not to get one, and the cost was visible: the OnlyFans
            add-on, being a page, had no way to reach the host's player and
            rendered a bare `<video>` of its own -- no external hand-off, no
            bookmarking, no resume, and inside the Android shell a video
            element with nowhere to go but the browser. A page and a section
            are lent the same thing now.
        */
        host: HostBridge;
    }) => Mounted | void;

    let mounted: Mounted | null = null;
    let loadedKey: string | null = null;

    async function load(target: HTMLElement, addon: string) {
        failure = null;

        try {
            // @vite-ignore -- the URL is only known at runtime, which is the
            // entire point; Vite must not try to resolve or bundle it.
            const module = await import(/* @vite-ignore */ addonAsset(addon, "addon.js"));
            const mount = (module.default ?? module.mount) as MountFn | undefined;

            if (typeof mount !== "function") {
                failure = "That add-on's page did not export a mount function";
                return;
            }

            mounted =
                (mount({
                    target,
                    path: rest,
                    api: `/api/v1/x/${addon}`,
                    navigate: (to) => goto(to),
                    host: hostBridge(addon)
                }) as Mounted) ?? null;
            loadedKey = addon;
        } catch (cause) {
            failure =
                cause instanceof Error ? cause.message : "That add-on's page could not be loaded";
        }
    }

    function teardown() {
        try {
            mounted?.destroy?.();
        } catch {
            // An add-on that throws on the way out must not break navigation
            // away from it -- which is the only way back to the page that
            // would let you remove it.
        }
        mounted = null;
        loadedKey = null;
    }

    $effect(() => {
        const target = host;
        const addon = key;

        if (!target || !addon) return;

        if (loadedKey !== addon) {
            teardown();
            target.replaceChildren();
            load(target, addon);
        }
    });

    // Internal navigation without a remount: the add-on owns the sub-path, so
    // tearing its page down and rebuilding it for every link inside it would
    // throw away scroll position and any list it had already loaded.
    $effect(() => {
        const path = rest;
        if (loadedKey === key) mounted?.update?.(path);
    });

    onDestroy(teardown);
</script>

<svelte:head>
    <title>{data.addon?.name ?? "Add-on"} — Riven</title>
    {#if key}
        <!-- The add-on's own stylesheet, alongside its bundle. Loaded here
             rather than injected by the bundle so it is present before the
             first paint instead of after it. -->
        <link rel="stylesheet" href={addonAsset(key, "addon.css")} />
    {/if}
</svelte:head>

{#if failure}
    <PageShell fallback="/" class="bg-background flex flex-col !pt-6">
        <div class="mx-auto max-w-xl px-4 py-16 text-center">
            <h1 class="text-lg font-medium text-white/90">
                {data.addon?.name ?? key} could not be displayed
            </h1>
            <p class="text-muted-foreground mt-2 text-sm">{failure}</p>
            <p class="text-muted-foreground mt-4 text-xs">
                Its API may still be working. Check the Add-ons section in Settings.
            </p>
        </div>
    </PageShell>
{/if}

<div bind:this={host} class="addon-root" class:hidden={failure !== null}></div>
