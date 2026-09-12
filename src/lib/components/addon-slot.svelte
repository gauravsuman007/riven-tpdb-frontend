<script lang="ts">
    import { onDestroy } from "svelte";
    import { goto } from "$app/navigation";
    import { addonAsset } from "$lib/addons";
    import { player } from "$lib/stores/player.svelte";
    import { slotted } from "$lib/addon-slots";

    /*
        Mounts every add-on that fills a named slot, in place.

        The mechanism is deliberately the same one `/x/[addon]` uses for a
        whole page -- a prebuilt ESM bundle the backend serves, imported at
        runtime and handed a DOM node -- because the alternative is that an
        add-on contributing a section has to be compiled into this app, which
        would make "install from a git URL" mean "install half of it and
        rebuild the frontend for the rest".

        The difference is what the bundle exports. A page is the module's
        default export; slots are a `slots` object keyed by slot name, so one
        bundle can serve both without the host guessing which it got.
    */

    type Mounted = { destroy?: () => void; update?: (props: unknown) => void };
    type SlotMount = (context: {
        target: HTMLElement;
        api: string;
        props: Record<string, unknown>;
        navigate: (to: string) => void;
        host: HostBridge;
    }) => Mounted | void;

    /*
        What the host lends a slot beyond its own API.

        Kept to almost nothing on purpose. Anything reachable over HTTP the
        add-on should fetch for itself -- bookmarks and VPN status are
        same-origin endpoints, and routing them through a bridge would mean
        this app had to grow a method every time an add-on wanted a URL it
        could already have asked for.

        The player is the exception, and the reason the bridge exists at all:
        it is in-page reactive state owned by this app's Svelte runtime, and
        the add-on's bundle carries a different one. There is no way to hand
        that across except as a function call.
    */
    type HostBridge = {
        /** Open a scraped video in the host's player, with everything the
         *  player needs to offer an external app, a bookmark, or a quality
         *  choice. Mirrors `player.openDirect`. */
        play: (options: {
            src: string;
            title: string;
            mimeType?: string;
            poster?: string;
            site?: string;
            videoId?: string;
            contextTitle?: string;
            duration?: number | null;
            resolution?: string | null;
            size?: number | null;
        }) => void;
    };

    const bridge: HostBridge = {
        play: (options) => player.openDirect(options)
    };

    let {
        name,
        only = null,
        props = {}
    }: {
        /** The slot's name, from the host's vocabulary. */
        name: string;
        /*
            Restrict the slot to one add-on.

            A slot is normally filled by every add-on that claims it -- three
            add-ons each contributing a section to a title's page is the point.
            One place needs the opposite: an add-on's own settings tab, which
            is rendered once per add-on and must show that add-on's panel
            rather than all of them in each of their tabs.
        */
        only?: string | null;
        /** What the host knows that the section needs -- for "details", the
         *  title and its library id. Passed on every change, so an add-on's
         *  section follows client-side navigation between two titles. */
        props?: Record<string, unknown>;
    } = $props();

    let host = $state<HTMLDivElement | null>(null);

    /*
        Nothing is rendered until an add-on has actually mounted.

        The wrapper has to stay in the DOM -- it is what `bind:this` gives
        the add-on to mount into, so an `{#if}` around it could never become
        true. `display: none` is the substitute, and it has to be that rather
        than an empty div left in place: a zero-height element still occupies
        a grid cell and still collects the surrounding layout's gap, which is
        how "the section does not show up" quietly becomes "the section is
        invisible but the page has a hole where it was".
    */
    let hasContent = $state(false);

    const mounts: Mounted[] = [];
    let token = 0;

    function teardown() {
        while (mounts.length) {
            try {
                mounts.pop()?.destroy?.();
            } catch {
                // An add-on that throws on the way out must not take the
                // host's page down with it, and must not strand the rest of
                // this loop: the remaining sections still need unmounting.
            }
        }
        hasContent = false;
    }

    /** The add-on's stylesheet, once per document. Added here rather than by
     *  the bundle so it is in place before the section's first paint. */
    function ensureStyles(key: string) {
        const href = addonAsset(key, "addon.css");
        if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) return;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.append(link);
    }

    async function load(target: HTMLElement) {
        const mine = ++token;
        const all = await slotted(name);
        const filling = only ? all.filter((addon) => addon.key === only) : all;

        // Navigation away, or to another title, while the list was in flight.
        if (mine !== token || !host) return;

        for (const addon of filling) {
            try {
                // @vite-ignore -- known only at runtime, which is the point.
                const module = await import(/* @vite-ignore */ addonAsset(addon.key, "addon.js"));
                const mount = module.slots?.[name] as SlotMount | undefined;

                if (mine !== token || typeof mount !== "function") continue;

                ensureStyles(addon.key);

                const element = document.createElement("div");
                target.append(element);

                const mounted = mount({
                    target: element,
                    api: `/api/v1/x/${addon.key}`,
                    props,
                    navigate: (to) => goto(to),
                    host: bridge
                });

                if (mounted) mounts.push(mounted);
                hasContent = true;
            } catch {
                /*
                    A section that cannot load renders as no section.

                    This is the one place where swallowing an error is the
                    right answer rather than a shortcut: the failure is an
                    add-on's, the surface is a page the add-on does not own,
                    and the user's recourse is in Settings either way. Showing
                    an error box on every title's page for a broken add-on
                    would punish the host's pages for the add-on's problem.
                */
            }
        }
    }

    $effect(() => {
        const target = host;
        const slot = name;
        // Read so the section reloads if the tab it is in changes add-on.
        void only;

        if (!target || !slot) return;

        teardown();
        target.replaceChildren();
        load(target);

        return () => {
            token++;
            teardown();
        };
    });

    // Props change without a remount -- moving between two titles should
    // update the section, not rebuild it.
    $effect(() => {
        const next = props;
        for (const mounted of mounts) {
            try {
                mounted.update?.(next);
            } catch {
                // Same reasoning as above.
            }
        }
    });

    onDestroy(() => {
        token++;
        teardown();
    });
</script>

<div bind:this={host} class:hidden={!hasContent}></div>
