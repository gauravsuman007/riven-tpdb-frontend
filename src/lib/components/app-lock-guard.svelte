<script lang="ts">
    /**
     * The screen lock, in full: idle clock, cover, and PIN entry.
     *
     * ONE PIECE, ON THE CLIENT, ON PURPOSE. The previous version split the
     * job -- the server decided and redirected to a /lock page, this
     * component only covered the pixels in the meantime. That was stricter
     * (a locked page was never sent its content) and it broke the Jellyfin
     * clients outright: the shell marks itself connected only when it sees a
     * request for `main.*.bundle.js`, the standalone lock page never emits
     * that script tag, and so unlocking dropped the client back to "Connect
     * to Server -- connection cannot be established". Reported exactly that
     * way. An overlay never navigates, so the page the client validated stays
     * loaded and its connection survives.
     *
     * The trade is honest and worth stating: this hides content that has
     * already been sent to the browser. It is a screen lock, not an auth
     * boundary -- see `schema/app-lock.ts`. The backend is not involved at
     * all any more; the only server call left is verifying the PIN, which
     * needs the hash.
     *
     * WHAT MAKES IT RELIABLE ACROSS SLEEP. The clock is `Date.now()` against
     * a stamp in localStorage, never a timer that has to keep running and
     * never a server's idea of the time. So it does not matter whether the
     * device suspended the tab, froze the WebView, or killed the process: on
     * the way back, the elapsed time is simply read. The two ways back in are
     * both covered -- `visibilitychange`/`pageshow` for a resumed page, and
     * the inline <head> script (see `hooks.server.ts`) for a page that was
     * reloaded from scratch, which paints the cover before <body> is even
     * parsed.
     */
    import { onMount } from "svelte";
    import { authClient } from "$lib/auth-client";

    interface Props {
        enabled: boolean;
        timeoutMinutes: number;
    }

    let { enabled, timeoutMinutes }: Props = $props();

    /** Shared with the inline <head> script in `hooks.server.ts`. */
    const STORAGE_KEY = "riven.applock";
    const LOCKED_ATTR = "data-app-locked";

    let locked = $state(false);
    let digits = $state("");
    let busy = $state(false);
    let message = $state("");
    let overlay: HTMLDivElement | null = $state(null);

    function timeoutMs(): number {
        return Math.max(1, timeoutMinutes) * 60_000;
    }

    function persist(lastActive: number): void {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ enabled, timeoutMinutes, lastActive })
            );
        } catch {
            // Private mode, quota, an embedded WebView with storage off: the
            // in-memory clock below still works for as long as the page
            // lives, which is strictly better than throwing here.
        }
    }

    function lastActive(): number {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (raw && typeof raw.lastActive === "number") return raw.lastActive;
        } catch {
            /* see persist() */
        }

        return Date.now();
    }

    function markActive(): void {
        if (locked) return;

        persist(Date.now());
    }

    /**
     * Any media element actually playing right now.
     *
     * `paused` is the honest signal: it stays false while a backgrounded
     * WebView keeps the audio going, which is exactly the case this exists
     * for.
     */
    function playingMedia(): HTMLMediaElement[] {
        return Array.from(
            document.querySelectorAll<HTMLMediaElement>("video, audio")
        ).filter((element) => !element.paused && !element.ended);
    }

    function lock(): void {
        if (locked) return;

        /*
            The attribute goes on synchronously, in the event handler, before
            Svelte has re-rendered anything. That is the whole reason it is a
            CSS attribute and not just component state: hiding the page must
            not wait on the framework's scheduler, because the frame it waits
            for is the frame that shows the content.
        */
        document.documentElement.setAttribute(LOCKED_ATTR, "1");
        locked = true;
        digits = "";
        message = "";

        /*
            Stop anything still playing. The overlay hides the picture but a
            <video> keeps its audio going behind it, which makes a "locked"
            app that is still audibly playing a film -- and on a phone, still
            showing it in the media notification.

            Only the in-page player is reachable from here. A native player
            (ExoPlayer, MX) is a different process with its own lifecycle and
            is deliberately left alone.
        */
        for (const element of playingMedia()) element.pause();
    }

    function unlocked(): void {
        document.documentElement.removeAttribute(LOCKED_ATTR);
        locked = false;
        digits = "";
        message = "";
        persist(Date.now());
    }

    function lockIfStale(): void {
        if (!enabled) return;
        if (Date.now() - lastActive() < timeoutMs()) return;

        /*
            Playback still running means the time that just elapsed was spent
            watching, so it counts as activity and the clock restarts.

            This is the case the stamp alone cannot see: a backgrounded
            WebView has its timers and events frozen, so `timeupdate` stops
            arriving and the stamp goes stale even though the film never
            stopped. Reported exactly that way -- come back after a while to
            a lock screen with the audio still playing underneath it.
        */
        if (playingMedia().length > 0) {
            persist(Date.now());
            return;
        }

        lock();
    }

    async function submit(): Promise<void> {
        if (digits.length !== 4 || busy) return;

        busy = true;
        message = "";

        try {
            const response = await fetch("/api/lock/unlock", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pin: digits })
            });

            if (response.ok) {
                unlocked();
                return;
            }

            const payload = await response.json().catch(() => ({}));
            message = payload?.message ?? "Incorrect code";
            digits = "";
        } catch {
            // Offline, or the server is down. Staying locked is the only safe
            // answer, but say so rather than looking like a wrong PIN.
            message = "Cannot reach the server";
            digits = "";
        } finally {
            busy = false;
        }
    }

    function press(digit: string): void {
        if (busy || digits.length >= 4) return;

        digits += digit;

        if (digits.length === 4) void submit();
    }

    function backspace(): void {
        digits = digits.slice(0, -1);
        message = "";
    }

    /** The way out for someone who cannot remember the code. */
    async function signOut(): Promise<void> {
        await authClient.signOut().catch(() => {});
        // A hard load, not a client navigation: signing out has to leave the
        // locked page behind entirely, cover and all.
        location.href = "/auth/login";
    }

    function onKey(event: KeyboardEvent): void {
        if (!locked) return;

        if (/^\d$/.test(event.key)) {
            event.preventDefault();
            press(event.key);
        } else if (event.key === "Backspace") {
            event.preventDefault();
            backspace();
        }
    }

    onMount(() => {
        /*
            The overlay is moved to be a direct child of <body> because the
            stylesheet that hides the page hides `body > *` -- and this
            component is rendered deep inside the layout, so without the move
            the overlay would be inside something it just hid.
        */
        if (overlay && overlay.parentElement !== document.body) {
            document.body.appendChild(overlay);
        }

        if (!enabled) {
            // A PIN that was just removed leaves a stale attribute from the
            // head script and a stale stamp; clear both rather than leaving
            // a page that can never be unlocked.
            document.documentElement.removeAttribute(LOCKED_ATTR);
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch {
                /* see persist() */
            }
            return;
        }

        /*
            Adopt whatever the head script already decided. It ran before this
            component existed and it is the authority for a fresh page load;
            re-deriving it here would only risk disagreeing with the cover
            that is already on screen.
        */
        if (document.documentElement.hasAttribute(LOCKED_ATTR)) {
            locked = true;
            for (const element of playingMedia()) element.pause();
        } else {
            persist(lastActive());
            lockIfStale();
        }

        const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

        for (const name of activityEvents) {
            window.addEventListener(name, markActive, { passive: true });
        }

        /*
            Playback counts as activity: watching a two-hour film without
            touching anything must not lock the screen out from under it.
            Captured on the document because media events do not bubble.
        */
        const onMedia = () => markActive();
        document.addEventListener("timeupdate", onMedia, { capture: true });
        document.addEventListener("playing", onMedia, { capture: true });

        // An open, idle page locks in place rather than waiting to be looked
        // at again. Cheap, and it never has to be accurate -- the stamp is.
        const timer = setInterval(lockIfStale, 10_000);

        // The case this feature is really about: the app was minimised for a
        // while and is being opened again.
        const onResume = () => {
            if (document.visibilityState === "hidden") return;
            lockIfStale();
        };

        document.addEventListener("visibilitychange", onResume);
        window.addEventListener("focus", onResume);
        window.addEventListener("pageshow", onResume);
        window.addEventListener("keydown", onKey);

        // "Lock now", from the settings page.
        const onLockNow = () => lock();
        window.addEventListener("riven:lock-now", onLockNow);

        return () => {
            for (const name of activityEvents) window.removeEventListener(name, markActive);
            document.removeEventListener("timeupdate", onMedia, { capture: true });
            document.removeEventListener("playing", onMedia, { capture: true });
            document.removeEventListener("visibilitychange", onResume);
            window.removeEventListener("focus", onResume);
            window.removeEventListener("pageshow", onResume);
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("riven:lock-now", onLockNow);
            clearInterval(timer);
        };
    });
</script>

<!--
    Always rendered, hidden when unlocked. Mounting it only while locked would
    mean creating and styling the element in the same frame that is supposed
    to already be covered.
-->
<div
    bind:this={overlay}
    id="app-lock-overlay"
    class="app-lock"
    class:app-lock--on={locked}
    aria-hidden={!locked}>
    {#if locked}
        <div class="app-lock__panel">
            <div class="app-lock__badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
            </div>

            <h1 class="app-lock__title">Locked</h1>
            <p class="app-lock__hint">Enter your 4-digit code to continue.</p>

            <div class="app-lock__dots">
                {#each [0, 1, 2, 3] as slot (slot)}
                    <span class="app-lock__dot" class:app-lock__dot--filled={digits.length > slot}
                    ></span>
                {/each}
            </div>

            <p class="app-lock__error" role="alert">{message}</p>

            <div class="app-lock__pad">
                {#each ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as key (key)}
                    <button type="button" onclick={() => press(key)} disabled={busy}>{key}</button>
                {/each}
                <span></span>
                <button type="button" onclick={() => press("0")} disabled={busy}>0</button>
                <button type="button" onclick={backspace} disabled={busy} aria-label="Delete">
                    &#9003;
                </button>
            </div>

            <button class="app-lock__out" type="button" onclick={signOut}>Sign out instead</button>
        </div>
    {/if}
</div>

<style>
    .app-lock {
        display: none;
    }

    .app-lock--on {
        position: fixed;
        inset: 0;
        /* Above everything, including the video overlay player. */
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        /* Opaque: a see-through cover is no cover. */
        background: #0b0b0f;
        color: #e8e8ef;
        font:
            500 15px/1.45 system-ui,
            -apple-system,
            sans-serif;
        -webkit-tap-highlight-color: transparent;
    }

    .app-lock__panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 1.5rem;
        width: min(20rem, 100%);
    }

    .app-lock__badge {
        width: 3.5rem;
        height: 3.5rem;
        display: grid;
        place-items: center;
        border: 1px solid #2a2a33;
        border-radius: 999px;
        color: #8b8b96;
    }

    .app-lock__badge svg {
        width: 1.6rem;
        height: 1.6rem;
    }

    .app-lock__title {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        letter-spacing: -0.01em;
    }

    .app-lock__hint {
        margin: 0;
        color: #8b8b96;
        font-size: 0.875rem;
    }

    .app-lock__dots {
        display: flex;
        gap: 0.75rem;
        margin: 0.5rem 0 0.25rem;
    }

    .app-lock__dot {
        width: 0.85rem;
        height: 0.85rem;
        border-radius: 999px;
        border: 1px solid #3a3a45;
    }

    .app-lock__dot--filled {
        background: #e8e8ef;
        border-color: #e8e8ef;
    }

    .app-lock__error {
        margin: 0;
        color: #f87171;
        font-size: 0.8125rem;
        min-height: 1.2em;
    }

    .app-lock__pad {
        display: grid;
        grid-template-columns: repeat(3, 4rem);
        gap: 0.6rem;
        margin-top: 0.5rem;
    }

    .app-lock__pad button {
        height: 3.25rem;
        border-radius: 0.75rem;
        border: 1px solid #26262f;
        background: #14141a;
        color: inherit;
        font-size: 1.15rem;
        font-weight: 600;
        cursor: pointer;
    }

    .app-lock__pad button:active {
        background: #1e1e26;
    }

    .app-lock__pad button:disabled {
        opacity: 0.5;
    }

    .app-lock__pad button:focus-visible {
        outline: 2px solid #6b6b7d;
        outline-offset: 2px;
    }

    .app-lock__out {
        margin-top: 0.75rem;
        border: 0;
        background: none;
        cursor: pointer;
        color: #8b8b96;
        font-size: 0.8125rem;
        text-decoration: underline;
    }
</style>
