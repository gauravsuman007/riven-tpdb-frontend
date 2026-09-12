/**
 * Handing one video to another application.
 *
 * There are two callers -- the overlay's "open in external player" button and
 * the store, when the client's DEFAULT player is an external one -- and they
 * must agree, because they are the same act. They did not: the store called
 * `openExternal(url)` on its own, which fires `Intent(ACTION_VIEW, uri)` with
 * no MIME type. On modern Android an http URI with no type is a WEB intent,
 * so only link handlers are candidates and the phone's browser wins with no
 * chooser at all. That is the whole of "it opens in the browser".
 *
 * The route that works addresses the video BY ID, through
 * `ExternalPlayer.initPlayer()`, which sets `setDataAndType(uri, "video/*")`.
 * The URL form stays as the last resort, for a shell that exposes `openUrl`
 * and no player bridge.
 */

/**
 * Wait for evidence that another app actually came to the front.
 *
 * None of the native entry points can tell us. They go through
 * `ExternalPlayer.initPlayer()`, which resolves the item through PlaybackInfo
 * on a coroutine and reports every failure -- bad play options, network
 * failure, unsupported content -- with an Android Toast and no callback at
 * all. A JS return value therefore says nothing about whether a player
 * opened. What IS observable is this page losing the foreground.
 */
export function awaitForeground(timeoutMs = 5000): Promise<boolean> {
    return new Promise((resolve) => {
        if (typeof document === "undefined") return resolve(false);
        if (document.hidden) return resolve(true);

        let settled = false;

        const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("riven:external-player", onReport);
            clearTimeout(timer);
            resolve(ok);
        };

        const onVisibility = () => {
            if (document.hidden) finish(true);
        };
        // The external player reporting back is proof it ran, and arrives
        // sooner than a visibility change on some shells.
        const onReport = () => finish(true);
        const timer = setTimeout(() => finish(false), timeoutMs);

        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("riven:external-player", onReport);
    });
}

export type HandoffOutcome = "opened" | "failed" | "unavailable";

/**
 * Try one native hand-off, and report what really happened.
 *
 * Three outcomes, not two. "declined" -- returned as null -- is the bridge
 * saying it is not the right route at all (`playDirect()` when no native
 * player is the default), and the caller should try the next one. "failed" is
 * the bridge taking the call and then not completing it, which is the
 * credential exchange going wrong and worth telling someone about.
 */
async function bridgeHandoff(
    method: "openInExternalPlayer" | "playDirect",
    itemId: string,
    onFailure: (message: string) => void,
    pause: () => void
): Promise<HandoffOutcome | null> {
    const bridge = window.RivenNative?.[method];

    if (!bridge) return null;

    // Paused before the wait, not after: two players pulling the same stream
    // is the thing to avoid, and the wait is seconds long.
    pause();

    const outcome = await new Promise<"declined" | "failed" | "accepted">((resolve) => {
        let called: boolean;

        try {
            called = !!bridge.call(window.RivenNative, itemId, (ok: boolean) =>
                resolve(ok ? "accepted" : "failed")
            );
        } catch {
            called = false;
        }

        if (!called) resolve("declined");
    });

    if (outcome === "declined") return null;

    if (outcome === "failed") {
        onFailure("Could not authenticate the hand-off to an external player");
        return "failed";
    }

    if (await awaitForeground()) return "opened";

    // The bridge took it and nothing opened. Say so -- the video is paused
    // where it was, so play resumes it.
    onFailure("The external player did not open. Check the client's player settings.");

    return "failed";
}

/**
 * Send a video to another app, by id first and by URL only as a fallback.
 *
 * `itemId` is a Jellyfin id: a library item's own, or one minted for a
 * scraped video or a multi-file release's playlist (see `direct-tokens.ts`).
 * Anything that has one should be handed over that way -- it is the only form
 * that produces a player chooser.
 */
export async function handOff(
    target: { itemId?: string | null; url?: string | null },
    options: {
        onFailure?: (message: string) => void;
        /** Stop the in-page player before something else starts buffering. */
        pause?: () => void;
    } = {}
): Promise<HandoffOutcome> {
    const onFailure = options.onFailure ?? (() => {});
    const pause = options.pause ?? (() => {});

    if (target.itemId) {
        // The external hand-off first, and NOT gated on the client's default
        // player: `ExternalPlayer.initPlayer()` has no isEnabled() check, so
        // it works even when the web player is selected -- which is the only
        // time the button that calls this is on screen at all.
        const external = await bridgeHandoff(
            "openInExternalPlayer",
            target.itemId,
            onFailure,
            pause
        );
        if (external) return external;

        // Then whichever native player is the default, for a shell that has a
        // player bridge but no external one.
        const native = await bridgeHandoff("playDirect", target.itemId, onFailure, pause);
        if (native) return native;
    }

    if (!target.url) {
        onFailure("Could not build a link for an external player");
        return "unavailable";
    }

    if (!window.RivenNative?.openExternal?.(target.url)) {
        onFailure("No app available to open this video");
        return "unavailable";
    }

    pause();

    return "opened";
}

/**
 * The id and URL for a scraped video, from the server.
 *
 * NOT the in-page player's own URL: that one is cookie-authenticated and has
 * no file extension, so another app can neither fetch it nor be matched to it
 * by Android's intent resolver.
 */
export async function directHandoffTarget(video: {
    site?: string | null;
    videoId?: string | null;
    title?: string | null;
    addon?: string | null;
}): Promise<{ itemId: string | null; url: string | null }> {
    if (!video.site || !video.videoId) return { itemId: null, url: null };

    const query = new URLSearchParams({
        site: video.site,
        videoId: video.videoId,
        title: video.title || "video"
    });

    // Which add-on owns the site key. Omitted only by a caller that genuinely
    // does not know; the server then falls back to the tube scraper, which is
    // where every site key came from before there was a second one.
    if (video.addon) query.set("addon", video.addon);

    try {
        const response = await fetch(`/api/direct/external_url?${query}`);

        if (!response.ok) return { itemId: null, url: null };

        const payload = await response.json();

        return { itemId: payload.itemId ?? null, url: payload.url ?? null };
    } catch {
        return { itemId: null, url: null };
    }
}
