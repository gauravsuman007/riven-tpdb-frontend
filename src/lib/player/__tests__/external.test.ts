/**
 * Handing a video to another application: WHAT travels, and by which route.
 *
 * This exists because the multi-file case has now been got wrong three
 * times, and every attempt looked right on the server. The thing that keeps
 * breaking is not a URL -- it is the shape of what the bridge is handed:
 *
 *   1. the item's own id          -> played file 1, the rest unreachable
 *   2. the playlist URL           -> untyped intent, a browser opened it
 *   3. one id for the playlist    -> the player got `audio/x-mpegurl` and
 *                                    its HLS demuxer rejected a plain list
 *
 * So these check the shape: every file goes over, as ids, on the typed
 * bridge, and nothing asks another application to parse a playlist.
 *
 * Run: npx tsx src/lib/player/__tests__/external.test.ts
 */

import { handOff, browserOptions } from "../external";

let pass = 0;
let fail = 0;

function check(name: string, condition: boolean, extra = "") {
    if (condition) {
        pass++;
        console.log(`  ok   ${name}`);
    } else {
        fail++;
        console.log(`  FAIL ${name} ${extra}`);
    }
}

/** What the shell was asked to open, recorded instead of acted on. */
type Call = { method: string; ids: unknown };

function fakeShell(options: { external?: boolean; native?: boolean; openUrl?: boolean } = {}) {
    const calls: Call[] = [];

    const bridge = (method: string) =>
        function (this: unknown, ids: unknown, done?: (ok: boolean) => void) {
            calls.push({ method, ids });
            done?.(true);
            return true;
        };

    const RivenNative: Record<string, unknown> = {};

    if (options.external) RivenNative.openInExternalPlayer = bridge("openInExternalPlayer");
    if (options.native) RivenNative.playDirect = bridge("playDirect");
    if (options.openUrl)
        RivenNative.openExternal = function (url: string) {
            calls.push({ method: "openExternal", ids: url });
            return true;
        };

    // The page going hidden is how `awaitForeground` learns something opened.
    const listeners: Record<string, (() => void)[]> = {};

    (globalThis as Record<string, unknown>).document = {
        hidden: true,
        addEventListener: (name: string, fn: () => void) => {
            (listeners[name] ??= []).push(fn);
        },
        removeEventListener: () => {}
    };
    (globalThis as Record<string, unknown>).window = {
        RivenNative,
        addEventListener: () => {},
        removeEventListener: () => {}
    };

    return { calls };
}

// --- A multi-file release ------------------------------------------------

{
    const { calls } = fakeShell({ external: true });
    const ids = ["fffffffe" + "a".repeat(24), "fffffffe" + "b".repeat(24)];

    const outcome = await handOff({
        itemId: ids[0],
        itemIds: ids,
        url: "http://host/Videos/35e/playlist.m3u"
    });

    check("a multi-file release opens", outcome === "opened");
    check("...on the TYPED bridge, not openUrl", calls[0]?.method === "openInExternalPlayer");
    check(
        "...carrying EVERY file, in order",
        JSON.stringify(calls[0]?.ids) === JSON.stringify(ids),
        JSON.stringify(calls[0]?.ids)
    );
    check("...and nothing else was tried", calls.length === 1);
    check(
        "...so no playlist URL was ever handed to another app",
        !calls.some((call) => String(call.ids).includes(".m3u"))
    );
}

// --- One file ------------------------------------------------------------

{
    const { calls } = fakeShell({ external: true });
    const id = "0".repeat(29) + "35e";

    await handOff({ itemId: id, url: "http://host/Videos/35e/stream.mp4" });

    check(
        "a single file is the one-entry case of the same list",
        JSON.stringify(calls[0]?.ids) === JSON.stringify([id])
    );
}

// --- No external bridge, but a native player ----------------------------

{
    const { calls } = fakeShell({ native: true });
    const ids = ["a".repeat(32), "b".repeat(32)];

    await handOff({ itemId: ids[0], itemIds: ids, url: "http://host/x" });

    check(
        "a shell with only a player bridge still gets every file",
        calls[0]?.method === "playDirect"
    );
    check("...as a list", JSON.stringify(calls[0]?.ids) === JSON.stringify(ids));
}

// --- No player bridge at all: the URL is the last resort -----------------

{
    const { calls } = fakeShell({ openUrl: true });

    await handOff({ itemId: null, itemIds: null, url: "http://host/Videos/35e/playlist.m3u" });

    check("with no player bridge the URL is used", calls[0]?.method === "openExternal");
}

// --- A plain browser on Android -----------------------------------------

{
    const options = browserOptions(
        { url: "http://host/a;b#c/stream.mp4", title: "Drive" },
        "android"
    );

    check("Android gets an intent:// option", options[0]?.id === "intent");
    check(
        "...typed as video, which is the whole point of it",
        options[0]?.href?.includes("type=video/*") === true
    );
    check(
        "...with the Intent syntax's own separators encoded, so it cannot truncate",
        options[0]?.href?.includes("%3B") === true && options[0]?.href?.includes("%23") === true
    );
    check(
        "copy link is always offered",
        options.some((option) => option.id === "copy")
    );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
