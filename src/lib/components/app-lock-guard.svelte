<script lang="ts">
    /**
     * Keeps the idle clock honest, and covers the screen the instant a stale
     * tab is looked at again.
     *
     * TWO HALVES, both needed.
     *
     * The SERVER decides whether a session is locked and redirects to /lock
     * before any page data loads -- that is what makes the lock leak-proof.
     * But a tab that was left open is already painted, and a server can do
     * nothing about pixels that are already on screen. So this covers the
     * viewport synchronously the moment the tab becomes visible again, then
     * navigates.
     *
     * The cover is raw DOM rather than Svelte state on purpose: a state change
     * is applied on the framework's schedule, and "before the next paint" is
     * exactly the guarantee needed here. Appending an element inside the
     * event handler is synchronous and cannot be deferred.
     */
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";

    interface Props {
        enabled: boolean;
        timeoutMinutes: number;
    }

    let { enabled, timeoutMinutes }: Props = $props();

    const COVER_ID = "app-lock-cover";

    /**
     * How often the server is told someone is here.
     *
     * Not on every event -- moving a mouse fires hundreds. Frequent enough
     * that the server's clock cannot drift far behind reality, rare enough
     * that it is invisible in the network log.
     */
    const BEACON_INTERVAL_MS = 60_000;

    /**
     * Locked slightly before the server would.
     *
     * The client's last-activity time is always at least as fresh as the
     * server's (the beacon is throttled), so without this margin a tab could
     * consider itself active while the server has already locked -- showing
     * content for the moment it takes the redirect to arrive.
     */
    const CLIENT_MARGIN_MS = 5_000;

    let lastActivity = Date.now();
    let lastBeacon = 0;

    function timeoutMs(): number {
        return Math.max(1, timeoutMinutes) * 60_000;
    }

    function stale(): boolean {
        return Date.now() - lastActivity >= timeoutMs() - CLIENT_MARGIN_MS;
    }

    function cover(): void {
        if (document.getElementById(COVER_ID)) return;

        const element = document.createElement("div");
        element.id = COVER_ID;
        // Inline, because a stylesheet may not have been applied yet in a tab
        // restored from the background, and a transparent cover is no cover.
        element.style.cssText =
            "position:fixed;inset:0;z-index:2147483647;background:#0b0b0f;" +
            "display:flex;align-items:center;justify-content:center;" +
            "color:#8b8b96;font:500 14px/1.4 system-ui,-apple-system,sans-serif";
        element.textContent = "Locked";

        document.body.appendChild(element);
    }

    function markActive(): void {
        lastActivity = Date.now();

        const now = Date.now();

        if (now - lastBeacon < BEACON_INTERVAL_MS) return;

        lastBeacon = now;

        // keepalive so a beacon fired as the tab is hidden still gets sent.
        void fetch("/api/lock/activity", { method: "POST", keepalive: true }).catch(() => {});
    }

    function lockNow(): void {
        cover();
        void goto(`/lock?next=${encodeURIComponent(location.pathname + location.search)}`, {
            replaceState: true
        });
    }

    onMount(() => {
        if (!enabled) return;

        const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

        for (const name of activityEvents) {
            window.addEventListener(name, markActive, { passive: true });
        }

        /*
            Playback counts as activity, which the requirement calls out
            explicitly: watching a two-hour film without touching anything
            must not lock the screen out from under it.

            Captured on the document because media events do not bubble --
            `timeupdate` would never reach a listener attached the usual way.
        */
        const onMedia = () => markActive();
        document.addEventListener("timeupdate", onMedia, { capture: true });
        document.addEventListener("playing", onMedia, { capture: true });

        // The tab is open and idle: lock in place rather than waiting for the
        // next navigation.
        const timer = setInterval(() => {
            if (stale()) lockNow();
        }, 15_000);

        // Coming back to a backgrounded tab. This is the case the requirement
        // is really about, and the one the server alone cannot cover.
        const onVisible = () => {
            if (document.visibilityState !== "visible") return;
            if (stale()) lockNow();
        };

        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", onVisible);
        window.addEventListener("pageshow", onVisible);

        markActive();

        return () => {
            for (const name of activityEvents) window.removeEventListener(name, markActive);
            document.removeEventListener("timeupdate", onMedia, { capture: true });
            document.removeEventListener("playing", onMedia, { capture: true });
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", onVisible);
            window.removeEventListener("pageshow", onVisible);
            clearInterval(timer);
        };
    });
</script>
