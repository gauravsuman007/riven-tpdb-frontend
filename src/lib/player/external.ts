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

export type HandoffOutcome = "opened" | "failed" | "unavailable" | "choosing";

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
    target: {
        itemId?: string | null;
        url?: string | null;
        /** The same stream as a playlist, for a desktop browser. */
        m3uUrl?: string | null;
        title?: string | null;
    },
    options: {
        onFailure?: (message: string) => void;
        /** Stop the in-page player before something else starts buffering. */
        pause?: () => void;
        /**
         * Offer a choice, in a plain browser on a platform where there is a
         * real one to make. Without it the first option is taken.
         */
        onChoices?: (choices: HandoffOption[]) => void;
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

    // A native shell takes the URL itself. Last resort even there: it fires
    // an untyped intent, so it is the route that loses the chooser.
    if (window.RivenNative?.openExternal?.(target.url)) {
        pause();
        return "opened";
    }

    /*
        No shell at all, so this is a plain browser -- and until now that
        ended here, with "No app available to open this video", on every
        desktop and in every mobile browser that is not the app's WebView.
        A browser has its own ways across; they just differ per platform.
    */
    const which = platform();
    const choices = browserOptions(
        { url: target.url, m3uUrl: target.m3uUrl, title: target.title },
        which
    );

    // Nothing but "copy link" means we could build no way across at all.
    if (choices.every((choice) => choice.id === "copy")) {
        onFailure("No app available to open this video");
        return "unavailable";
    }

    /*
        Android needs no menu: `intent://` asks Android itself, which shows
        the real chooser with the real list of installed players. Anywhere
        else the choice is ours to present, because the platform will not.
    */
    if (which === "android") {
        pause();
        takeOption(choices[0]);
        return "opened";
    }

    if (options.onChoices) {
        options.onChoices(choices);
        return "choosing";
    }

    takeOption(choices[0]);

    return "opened";
}

/**
 * Do what one option says: leave for another app, download the playlist, or
 * put the link on the clipboard.
 *
 * Returns whether the page is being left, which is what tells a caller
 * whether to close the player behind it.
 */
export function takeOption(option: HandoffOption): boolean {
    if (option.id === "copy") {
        // Only meaningful with a URL, and the copy option is built beside one.
        void navigator.clipboard?.writeText(option.href ?? "");
        return false;
    }

    if (!option.href) return false;

    if (option.download) {
        const link = document.createElement("a");

        link.href = option.href;
        link.download = option.download;
        // Firefox will not follow a link that is not in the document.
        document.body.appendChild(link);
        link.click();
        link.remove();

        return false;
    }

    window.location.href = option.href;

    return true;
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
}): Promise<{ itemId: string | null; url: string | null; m3uUrl: string | null }> {
    if (!video.site || !video.videoId) return { itemId: null, url: null, m3uUrl: null };

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

        if (!response.ok) return { itemId: null, url: null, m3uUrl: null };

        const payload = await response.json();

        return {
            itemId: payload.itemId ?? null,
            url: payload.url ?? null,
            m3uUrl: payload.m3uUrl ?? null
        };
    } catch {
        return { itemId: null, url: null, m3uUrl: null };
    }
}

// --------------------------------------------------------------------------
// Handing over from a PLAIN BROWSER, with no native shell underneath
// --------------------------------------------------------------------------

/**
 * Everything above this line needs `window.RivenNative`, which exists only
 * inside the Android shell. In Firefox on Android, Safari, Chrome or any
 * desktop browser it is undefined, so the whole chain ended at "No app
 * available to open this video" -- reported exactly that way, as "no
 * compatible player was found", from Firefox on Android.
 *
 * A browser cannot start another application directly. What it CAN do is
 * different on each platform, so there is one strategy per platform rather
 * than one clever trick:
 *
 *   Android -- an `intent://` URL. This is the only way to set a MIME TYPE
 *     from a page, and the type is the whole difference between a chooser
 *     full of video players and the browser opening the file itself (the
 *     same distinction that `openExternal` gets wrong natively). Chrome and
 *     Firefox both honour it.
 *
 *   iOS -- no chooser exists and no app can be enumerated, so the only
 *     option is to address a specific player by its own URL scheme. Three
 *     are offered because there is no way to ask which one is installed:
 *     picking one that is absent simply does nothing, which is why "copy
 *     link" is always in the list too.
 *
 *   Desktop -- no scheme is reliably registered by VLC/IINA/MPC, but every
 *     desktop OS opens a downloaded `.m3u` in whatever the default media
 *     player is. That is the one mechanism that works on Windows, macOS and
 *     Linux without asking the user to install anything.
 */
export type Platform = "android" | "ios" | "desktop";

export function platform(): Platform {
    if (typeof navigator === "undefined") return "desktop";

    const ua = navigator.userAgent;

    if (/android/i.test(ua)) return "android";

    // iPadOS 13+ reports itself as a Mac; the touch points are what still
    // separate it from a desktop.
    if (/iphone|ipad|ipod/i.test(ua)) return "ios";
    if (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";

    return "desktop";
}

/**
 * The same video as an Android intent URL, typed as video.
 *
 * `;` and `#` are the Intent syntax's own separators, so any that appear in
 * the URL are percent-encoded rather than passed through -- a link carrying
 * one would otherwise truncate the intent and hand the player half an
 * address.
 */
function intentUrl(url: string, title: string): string {
    const parsed = new URL(url);
    const scheme = parsed.protocol.replace(":", "");
    const rest = url.slice(parsed.protocol.length + 2).replace(/;/g, "%3B").replace(/#/g, "%23");

    const extras = [
        `scheme=${scheme}`,
        "type=video/*",
        "action=android.intent.action.VIEW",
        // Shown by players that read it, and harmless to those that do not.
        `S.title=${encodeURIComponent(title || "Video")}`,
        // If nothing handles it, come back to the page instead of leaving a
        // dead tab.
        `S.browser_fallback_url=${encodeURIComponent(url)}`,
        "end"
    ];

    return `intent://${rest}#Intent;${extras.join(";")}`;
}

export interface HandoffOption {
    id: string;
    label: string;
    /** Where picking it goes. Absent for options that only act on the page. */
    href?: string;
    /** Download rather than navigate -- the `.m3u` route. */
    download?: string;
    /** True when choosing it leaves the page, so the overlay should close. */
    leaves?: boolean;
}

/**
 * What this browser can actually offer for this video.
 *
 * `m3uUrl` is the playlist form of the same stream; both `external_url`
 * endpoints return it beside the direct URL.
 */
export function browserOptions(
    target: { url?: string | null; m3uUrl?: string | null; title?: string | null },
    which: Platform = platform()
): HandoffOption[] {
    const url = target.url;

    if (!url) return [];

    const title = target.title || "Video";
    const options: HandoffOption[] = [];

    if (which === "android") {
        options.push({
            id: "intent",
            label: "Open in a video player",
            href: intentUrl(url, title),
            leaves: true
        });
    }

    if (which === "ios") {
        options.push(
            {
                id: "vlc",
                label: "VLC",
                href: `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`,
                leaves: true
            },
            {
                id: "infuse",
                label: "Infuse",
                href: `infuse://x-callback-url/play?url=${encodeURIComponent(url)}`,
                leaves: true
            },
            {
                id: "outplayer",
                label: "Outplayer",
                href: `outplayer://${url}`,
                leaves: true
            }
        );
    }

    if (which === "desktop" && target.m3uUrl) {
        options.push({
            id: "m3u",
            label: "Open in your default player",
            href: target.m3uUrl,
            download: `${title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "video"}.m3u`
        });
    }

    // Always last, always present: the one thing that cannot fail, and the
    // only recourse when the chosen app turns out not to be installed.
    options.push({ id: "copy", label: "Copy link", href: url });

    return options;
}
