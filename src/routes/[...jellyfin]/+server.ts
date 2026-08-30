/**
 * The Jellyfin-compatible API and web app, all in one place.
 *
 * WHY THIS LIVES HERE, IN THE FRONTEND, NOT THE BACKEND:
 *
 * The official Jellyfin for Android (mobile) app and the LG webOS app are
 * WebView shells with no interface of their own -- they validate a server
 * over this exact protocol, then load a UI from it. This used to be answered
 * by the Python backend with a hand-rolled reverse proxy in front of THIS
 * app's own pages, so a Jellyfin client could see the real Riven UI. Every
 * bug that produced came from bridging two independently-configured origins
 * by hand: SvelteKit's CSRF check pins a fixed `ORIGIN`; a login response's
 * three `Set-Cookie` headers collapsed into one malformed value going
 * through the proxy's naive header handling. Moving the whole protocol here
 * -- where the real pages and the Jellyfin surface are naturally the SAME
 * origin -- removes the bridge instead of patching it again.
 *
 * This is a single catch-all rather than a directory per Jellyfin path
 * (`/System/Info/Public`, `/Users/AuthenticateByName`, ...) for two reasons:
 * real clients send inconsistent casing (Jellyfin's own server is ASP.NET,
 * whose routing is case-insensitive, and clients were written against that),
 * and a catch-all only ever sees paths SvelteKit's own routes did not already
 * claim -- so nothing here can shadow the real app.
 *
 * Route order in `MATCH` matters: `/Users/AuthenticateByName`, `/Users/Me`
 * and `/Users/Public` must be tried BEFORE the `/Users/{id}` pattern, same as
 * the Python router this replaces required.
 *
 * Video delivery is the one thing intentionally NOT reimplemented here: it is
 * a thin proxy to this app's OWN existing `/api/stream/...` routes (already
 * used by the browser player, calling the backend's `routers/secure/stream.py`
 * -- Range handling, debrid link resolution, HLS transcode sessions). That
 * logic only exists in Python and reimplementing it in Node would be a much
 * larger, separate project; see the frontend AGENTS.md.
 */

import { randomUUID } from "node:crypto";

import { error, type RequestHandler } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { user } from "$lib/server/schema";
import { BUNDLE_JS, BUNDLE_PATH } from "$lib/server/jellyfin/bundle";
import { jellyfinEnabled, jellyfinServerName, jellyfinUsername } from "$lib/server/jellyfin/config";
import * as identity from "$lib/server/jellyfin/auth";
import { LIBRARY_ID, SERVER_ID, USER_ID, fromDirectGuid, fromGuid, toGuid } from "$lib/utils/jellyfin-ids";
import { baseItem, mediaSourceDto } from "$lib/server/jellyfin/mapping";
import { issuePlaySession, isValidPlaySession } from "$lib/server/jellyfin/play-sessions";
import { resolveDirectToken } from "$lib/server/direct-tokens";
import {
    getProgress,
    getProgressMany,
    setPlayed,
    setProgress
} from "$lib/server/playback-progress";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Ctx = Parameters<RequestHandler>[0];

function json(body: Json | Json[], init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...(init?.headers || {}) }
    });
}

function noContent(): Response {
    return new Response(null, { status: 204 });
}

function notFound(): Response {
    return new Response("Not found", { status: 404 });
}

function requireEnabled() {
    if (!jellyfinEnabled()) error(404, "Not found");
}

function requireAuth(event: Ctx, apiKey: string): identity.ClientIdentity {
    requireEnabled();

    const id = identity.identify(event.request.headers, event.url.searchParams);

    if (!identity.isValidToken(id.token, apiKey)) {
        error(401, "Invalid token");
    }

    return id;
}

/**
 * Auth for the stream routes specifically.
 *
 * Same as `requireAuth`, except a valid `playSessionId` for THIS item is also
 * accepted. That is what lets an external player (VLC, MX Player) play a
 * library title: the app builds its URL with no credentials at all -- see
 * `play-sessions.ts` for the source trace -- so an api-key-only check 401s and
 * the player reports "can't play this file".
 */
function requireStreamAuth(event: Ctx, apiKey: string, rivenId: number): void {
    requireEnabled();

    const playSession =
        event.url.searchParams.get("playSessionId") ??
        event.url.searchParams.get("PlaySessionId");

    if (isValidPlaySession(playSession, rivenId)) return;

    requireAuth(event, apiKey);
}


async function backendFetch(event: Ctx, path: string, init?: RequestInit): Promise<Response> {
    return event.fetch(`${event.locals.backendUrl}${path}`, {
        ...init,
        headers: { "x-api-key": event.locals.apiKey, ...(init?.headers || {}) }
    });
}

// --------------------------------------------------------------------------
// System / identity
// --------------------------------------------------------------------------

/**
 * Whose progress a Jellyfin request is reading or writing.
 *
 * The Jellyfin surface authenticates with the backend API key, not a
 * better-auth session, so there is exactly one identity behind it -- the same
 * account `local_access` grants. Resume therefore follows the person, not the
 * app: a scene started in the browser resumes in the TV client because both
 * resolve to this id.
 */
function progressUserId(): string | null {
    const account = db.select().from(user).orderBy(user.createdAt).get();
    return account?.id ?? null;
}

/** Attach stored positions to a page of items in one query. */
async function withProgress(items: Json[]): Promise<Json[]> {
    const userId = progressUserId();
    const positions = userId
        ? getProgressMany(
              userId,
              items.map((item) => Number(item.id))
          )
        : new Map();

    return Promise.all(items.map((item) => baseItem(item, null, positions.get(Number(item.id)))));
}


function publicInfo(event: Ctx): Json {
    return {
        LocalAddress: event.url.origin,
        ServerName: jellyfinServerName(),
        Version: "10.10.3",
        ProductName: "Jellyfin Server",
        OperatingSystem: "Linux",
        Id: SERVER_ID.replace(/-/g, ""),
        StartupWizardCompleted: true
    };
}

function userDto(): Json {
    return {
        Name: jellyfinUsername(),
        ServerId: SERVER_ID.replace(/-/g, ""),
        Id: USER_ID.replace(/-/g, ""),
        HasPassword: true,
        HasConfiguredPassword: true,
        HasConfiguredEasyPassword: false,
        EnableAutoLogin: false,
        // The Kotlin SDK's UserConfiguration serializer has no defaults for
        // any of these -- a missing key throws MissingFieldException
        // client-side (confirmed via device logcat) even though HTTP-wise
        // this response looks fine.
        Configuration: {
            PlayDefaultAudioTrack: true,
            DisplayMissingEpisodes: false,
            SubtitleMode: "Default",
            EnableNextEpisodeAutoPlay: false,
            GroupedFolders: [],
            DisplayCollectionsView: false,
            EnableLocalPassword: false,
            OrderedViews: [],
            LatestItemsExcludes: [],
            MyMediaExcludes: [],
            HidePlayedInLatest: true,
            RememberAudioSelections: true,
            RememberSubtitleSelections: true
        },
        // Same story as Configuration above: the Kotlin SDK's UserPolicy
        // serializer requires every one of these with no default.
        Policy: {
            IsAdministrator: true,
            IsHidden: false,
            IsDisabled: false,
            EnableMediaPlayback: true,
            EnableAudioPlaybackTranscoding: true,
            EnableVideoPlaybackTranscoding: true,
            EnablePlaybackRemuxing: true,
            EnableContentDeletion: false,
            EnableContentDownloading: true,
            EnableRemoteAccess: true,
            EnableAllFolders: true,
            EnabledFolders: [],
            BlockedTags: [],
            AccessSchedules: [],
            EnableUserPreferenceAccess: true,
            EnableRemoteControlOfOtherUsers: false,
            EnableSharedDeviceControl: false,
            EnableLiveTvManagement: false,
            EnableLiveTvAccess: false,
            ForceRemoteSourceTranscoding: false,
            EnableSyncTranscoding: true,
            EnableMediaConversion: false,
            EnableAllDevices: true,
            EnableAllChannels: true,
            InvalidLoginAttemptCount: 0,
            LoginAttemptsBeforeLockout: -1,
            MaxActiveSessions: 0,
            EnablePublicSharing: false,
            RemoteClientBitrateLimit: 0,
            AuthenticationProviderId: "org.jellyfin.sdk.model.api.AuthenticationProvider",
            PasswordResetProviderId: "org.jellyfin.sdk.model.api.PasswordResetProvider",
            SyncPlayAccess: "None"
        }
    };
}

function libraryDto(): Json {
    return {
        Id: LIBRARY_ID.replace(/-/g, ""),
        ServerId: SERVER_ID.replace(/-/g, ""),
        Name: "Library",
        Type: "CollectionFolder",
        CollectionType: "movies",
        IsFolder: true,
        MediaType: "Unknown",
        ImageTags: {},
        BackdropImageTags: [],
        UserData: { PlaybackPositionTicks: 0, PlayCount: 0, Played: false }
    };
}

// --------------------------------------------------------------------------
// Library browsing -- all backed by this app's existing BACKEND_URL/API_KEY
// --------------------------------------------------------------------------

// States a client should be shown: "in the library" always means "playable"
// to a Jellyfin client, which has no notion of "requested but not downloaded
// yet". Showing those would make most of the grid dead ends.
const PLAYABLE_STATES = ["Symlinked", "Completed", "PartiallyCompleted", "Downloaded"];

async function fetchItems(
    event: Ctx,
    opts: { search?: string | null; limit?: number; startIndex?: number; sortBy?: string | null; sortOrder?: string | null; ids?: number[] }
): Promise<{ items: Json[]; total: number }> {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(opts.limit ?? 100, 1000)));
    params.set("page", String(Math.floor((opts.startIndex ?? 0) / (opts.limit ?? 100)) + 1));
    for (const type of ["movie"]) params.append("type", type);
    for (const state of PLAYABLE_STATES) params.append("states", state);
    if (opts.search) params.set("search", opts.search);

    const sortKey = (opts.sortBy || "").split(",")[0].trim().toLowerCase();
    const descending = (opts.sortOrder || "").trim().toLowerCase() === "descending";
    const sortMap: Record<string, string> = {
        sortname: "title",
        name: "title",
        premieredate: "date",
        productionyear: "date",
        datecreated: "date"
    };
    const sortField = sortMap[sortKey] || "title";
    params.append("sort", `${sortField}_${descending ? "desc" : "asc"}`);

    const response = await backendFetch(event, `/api/v1/items?${params.toString()}`);

    if (!response.ok) return { items: [], total: 0 };

    const data = (await response.json()) as { items?: Json[]; total_items?: number };
    let items = data.items || [];

    if (opts.ids && opts.ids.length) {
        const wanted = new Set(opts.ids);
        items = items.filter((item) => wanted.has(Number(item.id)));
    }

    return { items, total: data.total_items ?? items.length };
}

async function fetchItem(event: Ctx, rivenId: number): Promise<Json | null> {
    const response = await backendFetch(
        event,
        `/api/v1/items/${rivenId}?media_type=item&extended=true`
    );

    if (!response.ok) return null;

    return response.json();
}

async function fetchPlaybackInfo(
    event: Ctx,
    rivenId: number
): Promise<{ container: string | null; durationSeconds: number | null; mode: string } | null> {
    const response = await backendFetch(event, `/api/v1/stream/playback_info/${rivenId}`);

    if (!response.ok) return null;

    const data = (await response.json()) as {
        probe?: { container?: string | null; duration?: number | null };
        mode?: string;
    };

    return {
        container: data.probe?.container ?? null,
        durationSeconds: data.probe?.duration ?? null,
        mode: data.mode ?? "direct"
    };
}

// --------------------------------------------------------------------------
// Video delivery -- thin proxy to this app's own existing stream routes
// --------------------------------------------------------------------------

async function proxyStream(event: Ctx, rivenId: number): Promise<Response> {
    const headers: HeadersInit = {};
    const range = event.request.headers.get("range");
    if (range) headers["range"] = range;

    const response = await backendFetch(event, `/api/v1/stream/file/${rivenId}${event.url.search}`, {
        headers
    });

    const forwarded = new Headers();
    for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "content-disposition"]) {
        const value = response.headers.get(name);
        if (value) forwarded.set(name, value);
    }

    return new Response(response.body, { status: response.status, headers: forwarded });
}

async function proxyHlsPlaylist(event: Ctx, rivenId: number): Promise<Response> {
    const response = await backendFetch(event, `/api/v1/stream/hls/${rivenId}/index.m3u8`);
    const type = response.headers.get("content-type");

    return new Response(response.body, {
        status: response.status,
        headers: type ? { "content-type": type } : {}
    });
}

async function proxyHlsSegment(event: Ctx, rivenId: number, seq: number): Promise<Response> {
    const response = await backendFetch(event, `/api/v1/stream/hls/${rivenId}/segment/${seq}.ts`);
    const type = response.headers.get("content-type");

    return new Response(response.body, {
        status: response.status,
        headers: {
            ...(type ? { "content-type": type } : {}),
            "cache-control": "public, max-age=3600"
        }
    });
}

// --------------------------------------------------------------------------
// Router
// --------------------------------------------------------------------------

type Handler = (event: Ctx, match: RegExpMatchArray) => Promise<Response> | Response;

interface Route {
    method: string;
    pattern: RegExp;
    handler: Handler;
}

function route(method: string, path: string, handler: Handler): Route {
    // Turn a Jellyfin-shaped path template into a case-insensitive regex.
    // `{name}` becomes a capturing group of non-slash characters.
    const pattern = new RegExp(
        "^" + path.replace(/\{[^}]+\}/g, "([^/]+)").replace(/\//g, "\\/") + "$",
        "i"
    );

    return { method, pattern, handler };
}

const ROUTES: Route[] = [
    // --- The web app bootstrap ---------------------------------------------
    route("GET", BUNDLE_PATH, () => new Response(BUNDLE_JS, { headers: { "content-type": "application/javascript; charset=utf-8" } })),
    /*
        Step two of the LG webOS client's connection handshake.

        From jellyfin-webos `frontend/js/index.js`: the success handler for
        /System/Info/Public immediately calls `getManifest()` for
        /web/manifest.json, and a 404 there lands in `handleFailure` --
        "Got HTTP error 404 from server, are you connecting to a Jellyfin
        Server?" -- with no further requests. The Android client never asks
        for it, which is why only webOS failed.

        `start_url` is resolved as `baseurl + "/web/" + start_url` unless it
        already contains "/web", so this sends the client to /web/index.html,
        which is redirected to the app below.
    */
    route("GET", "/web/manifest.json", () => {
        requireEnabled();

        return json({
            name: jellyfinServerName(),
            short_name: jellyfinServerName(),
            start_url: "index.html",
            display: "standalone",
            background_color: "#09090b",
            theme_color: "#09090b",
            icons: []
        });
    }),

    // Where that manifest points. The app itself lives at the root.
    route("GET", "/web/index.html", () => {
        requireEnabled();

        return new Response(null, { status: 302, headers: { location: "/" } });
    }),

    route("GET", "/web/session-token", async (event) => {
        requireEnabled();

        const session = await auth.api.getSession({ headers: event.request.headers });

        if (!session) return new Response(null, { status: 401 });

        return json({
            ServerId: SERVER_ID.replace(/-/g, ""),
            UserId: USER_ID.replace(/-/g, ""),
            AccessToken: event.locals.apiKey
        });
    }),

    // --- System -------------------------------------------------------------
    route("GET", "/System/Info/Public", (event) => {
        requireEnabled();
        return json(publicInfo(event));
    }),
    route("GET", "/System/Info", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json({
            ...publicInfo(event),
            HasUpdateAvailable: false,
            SupportsLibraryMonitor: false,
            WebSocketPortNumber: 8080,
            CompletedInstallations: [],
            CanSelfRestart: false,
            CanLaunchWebBrowser: false
        });
    }),
    route("GET", "/System/Endpoint", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json({ IsLocal: true, IsInNetwork: true });
    }),

    // --- Auth -----------------------------------------------------------------
    route("POST", "/Users/AuthenticateByName", async (event) => {
        requireEnabled();

        let body: Json;
        try {
            body = await event.request.json();
        } catch {
            return new Response("Malformed body", { status: 400 });
        }

        const username = body.Username || body.username || "";
        // Jellyfin sends the password as "Pw"; "Password" is the older field
        // and some clients still send it.
        const password = body.Pw || body.Password || "";
        const caller = identity.identify(event.request.headers, event.url.searchParams);

        if (!identity.checkPassword(username, password, event.locals.apiKey)) {
            return new Response("Invalid username or password", { status: 401 });
        }

        return json({
            User: userDto(),
            SessionInfo: {
                Id: USER_ID.replace(/-/g, ""),
                UserId: USER_ID.replace(/-/g, ""),
                UserName: jellyfinUsername(),
                Client: caller.client || "",
                DeviceName: caller.device || "",
                DeviceId: caller.deviceId || "",
                ApplicationVersion: caller.version || "",
                SupportsRemoteControl: false
            },
            AccessToken: identity.issueToken(event.locals.apiKey),
            ServerId: SERVER_ID.replace(/-/g, "")
        });
    }),
    route("GET", "/Users/Me", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json(userDto());
    }),
    route("GET", "/Users/Public", (event) => {
        requireEnabled();
        // Deliberately empty -- listing the user here would let a client
        // offer a tap-to-log-in tile, the wrong affordance for a server
        // whose password is an API key.
        return json([]);
    }),
    route("GET", "/Users/{userId}", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json(userDto());
    }),

    // --- Library structure ------------------------------------------------
    route("GET", "/Users/{userId}/Views", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json({ Items: [libraryDto()], TotalRecordCount: 1, StartIndex: 0 });
    }),
    route("GET", "/UserViews", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json({ Items: [libraryDto()], TotalRecordCount: 1, StartIndex: 0 });
    }),
    route("GET", "/Library/VirtualFolders", (event) => {
        requireAuth(event, event.locals.apiKey);
        return json([
            { Name: "Library", ItemId: LIBRARY_ID.replace(/-/g, ""), CollectionType: "movies", Locations: [], LibraryOptions: {} }
        ]);
    }),

    // --- Browsing -----------------------------------------------------------
    route("GET", "/Users/{userId}/Items/Latest", async (event) => {
        requireAuth(event, event.locals.apiKey);

        const limit = Math.min(Number(event.url.searchParams.get("limit") ?? 20), 100);
        const { items } = await fetchItems(event, { limit, sortBy: "DateCreated", sortOrder: "Descending" });

        return json(await withProgress(items));
    }),
    route("GET", "/Items", async (event) => {
        requireAuth(event, event.locals.apiKey);
        return itemsListResponse(event);
    }),
    route("GET", "/Users/{userId}/Items", async (event) => {
        requireAuth(event, event.locals.apiKey);
        return itemsListResponse(event);
    }),
    route("GET", "/Items/{itemId}", async (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return itemDetailResponse(event, match[1]);
    }),
    route("GET", "/Users/{userId}/Items/{itemId}", async (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return itemDetailResponse(event, match[2]);
    }),
    route("GET", "/Items/{itemId}/Images/{imageType}", async (event, match) => {
        // Unauthenticated on purpose: clients load images from plain <img>
        // tags carrying no token, and the poster URL discloses nothing the
        // item list did not already.
        requireEnabled();

        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();

        const item = await fetchItem(event, rivenId);
        if (!item || !item.poster_path) return notFound();

        // NOT Response.redirect(): it returns a Response with an IMMUTABLE
        // Headers object (guard: "immutable"), and SvelteKit's own hook chain
        // tries to append Set-Cookie onto every outgoing response (this app
        // sets a tvdb_cookie on demand) -- that throws "TypeError: immutable"
        // and turns this into a 500. A plain Response with a mutable Headers
        // object is what the framework can actually merge into.
        return new Response(null, { status: 302, headers: { location: item.poster_path } });
    }),
    route("GET", "/Items/{itemId}/PlaybackInfo", async (event, match) => playbackInfoResponse(event, match[1])),
    route("POST", "/Items/{itemId}/PlaybackInfo", async (event, match) => playbackInfoResponse(event, match[1])),

    // --- Display preferences / sessions (accepted, mostly discarded) --------
    route("GET", "/DisplayPreferences/{preferenceId}", (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return json({
            Id: match[1],
            SortBy: "SortName",
            SortOrder: "Ascending",
            ViewType: "Poster",
            Client: "riven",
            RememberIndexing: false,
            RememberSorting: false,
            PrimaryImageHeight: 250,
            PrimaryImageWidth: 250,
            // The Kotlin SDK's DisplayPreferencesDto serializer requires
            // these with no defaults (confirmed via device logcat).
            ScrollDirection: "Horizontal",
            ShowBackdrop: true,
            ShowSidebar: false,
            CustomPrefs: {}
        });
    }),
    route("POST", "/DisplayPreferences/{preferenceId}", (event) => {
        requireAuth(event, event.locals.apiKey);
        return noContent();
    }),
    // The three playback-reporting calls every Jellyfin client makes on its
    // own, with no cooperation needed from the page. Implementing them is
    // what makes resume work identically on Android, webOS and anything else
    // speaking this protocol -- they were previously accepted and discarded,
    // which is why nothing ever resumed outside the browser.
    route("POST", "/Sessions/Playing", (event) => {
        requireEnabled();
        return recordProgress(event);
    }),
    route("POST", "/Sessions/Playing/Progress", (event) => {
        requireEnabled();
        return recordProgress(event);
    }),
    route("POST", "/Sessions/Playing/Stopped", (event) => {
        requireEnabled();
        return recordProgress(event);
    }),
    // Explicit "mark watched / unwatched" from a client's context menu.
    route("POST", "/Users/{userId}/PlayedItems/{itemId}", (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return markPlayed(match[2], true);
    }),
    route("DELETE", "/Users/{userId}/PlayedItems/{itemId}", (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return markPlayed(match[2], false);
    }),
    route("POST", "/UserPlayedItems/{itemId}", (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return markPlayed(match[1], true);
    }),
    route("DELETE", "/UserPlayedItems/{itemId}", (event, match) => {
        requireAuth(event, event.locals.apiKey);
        return markPlayed(match[1], false);
    }),
    route("POST", "/Sessions/Capabilities", (event) => {
        requireEnabled();
        return noContent();
    }),
    route("POST", "/Sessions/Capabilities/Full", (event) => {
        requireEnabled();
        return noContent();
    }),

    // --- Video delivery -- proxied to this app's own existing stream routes -
    route("GET", "/Videos/{itemId}/stream", async (event, match) => {
        const direct = directStreamRedirect(match[1]);
        if (direct) return direct;

        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();
        requireStreamAuth(event, event.locals.apiKey, rivenId);
        return proxyStream(event, rivenId);
    }),
    route("GET", "/Videos/{itemId}/stream.{container}", async (event, match) => {
        const direct = directStreamRedirect(match[1]);
        if (direct) return direct;

        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();
        requireStreamAuth(event, event.locals.apiKey, rivenId);
        return proxyStream(event, rivenId);
    }),
    route("GET", "/Videos/{itemId}/main.m3u8", async (event, match) => {
        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();
        requireStreamAuth(event, event.locals.apiKey, rivenId);
        return proxyHlsPlaylist(event, rivenId);
    }),
    route("GET", "/Videos/{itemId}/hls1/{playlist}/{seq}.ts", async (event, match) => {
        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();
        requireStreamAuth(event, event.locals.apiKey, rivenId);
        return proxyHlsSegment(event, rivenId, Number(match[3]));
    }),
    route("GET", "/Videos/{itemId}/segment/{seq}.ts", async (event, match) => {
        const rivenId = fromGuid(match[1]);
        if (rivenId === null) return notFound();
        requireStreamAuth(event, event.locals.apiKey, rivenId);
        return proxyHlsSegment(event, rivenId, Number(match[2]));
    })
];

async function itemsListResponse(event: Ctx): Promise<Response> {
    const params = event.url.searchParams;
    const idsParam = params.get("Ids");
    const wanted = idsParam
        ? idsParam
              .split(",")
              .map((raw) => fromGuid(raw.trim()))
              .filter((v): v is number => v !== null)
        : undefined;

    if (idsParam && (!wanted || !wanted.length)) {
        return json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
    }

    const startIndex = Number(params.get("startIndex") ?? 0);
    const limit = Number(params.get("limit") ?? 100);

    const { items, total } = await fetchItems(event, {
        search: params.get("searchTerm"),
        startIndex,
        limit,
        sortBy: params.get("sortBy"),
        sortOrder: params.get("sortOrder"),
        ids: wanted
    });

    return json({
        Items: await withProgress(items),
        TotalRecordCount: wanted ? items.length : total,
        StartIndex: startIndex
    });
}

/**
 * Persist a position reported by a Jellyfin client.
 *
 * Never fails the request: these are fire-and-forget telemetry calls made
 * during playback, and a client that gets an error back from one may stop
 * reporting for the rest of the session. A dropped position is a much smaller
 * problem than playback reacting to a database hiccup, so anything unexpected
 * is swallowed after being logged.
 */
async function recordProgress(event: Ctx): Promise<Response> {
    try {
        const body = (await event.request.json().catch(() => null)) as Json | null;

        if (!body) return noContent();

        const rivenId = fromGuid(String(body.ItemId ?? body.itemId ?? ""));
        const userId = progressUserId();

        if (rivenId === null || !userId) return noContent();

        setProgress(
            userId,
            rivenId,
            Number(body.PositionTicks ?? body.positionTicks ?? 0),
            // Clients omit runtime on most reports; the stored value is kept
            // when they do, so "finished" stays decidable.
            Number(body.RunTimeTicks ?? body.runTimeTicks ?? 0) || null
        );
    } catch (err) {
        console.error("[jellyfin] could not record playback progress:", err);
    }

    return noContent();
}

function markPlayed(guid: string, played: boolean): Response {
    const rivenId = fromGuid(guid);
    const userId = progressUserId();

    if (rivenId === null || !userId) return notFound();

    setPlayed(userId, rivenId, played);
    return noContent();
}


/**
 * The Jellyfin view of a direct-scrape video.
 *
 * These have no MediaItem, no container we can know ahead of time and no
 * duration the server is sure of, so almost every field is a plausible
 * default. That is enough: the only consumers are the two native players,
 * which need a name, a playable URL and a media type -- not a catalogue entry.
 * It is deliberately NOT surfaced in /Items listings, so it never appears as
 * a library row that would 404 the moment its token expired.
 */
function directItemDto(guid: string, title: string): Json {
    return {
        Id: guid,
        ServerId: SERVER_ID,
        Name: title || "Video",
        Type: "Movie",
        MediaType: "Video",
        IsFolder: false,
        LocationType: "FileSystem",
        ParentId: LIBRARY_ID,
        RunTimeTicks: null,
        UserData: { PlaybackPositionTicks: 0, Played: false, PlayCount: 0 },
        MediaSources: [directSourceDto(guid, title)]
    };
}

function directSourceDto(guid: string, title: string): Json {
    const source = mediaSourceDto(guid, title || "Video", "mp4", null);

    /*
        Direct play only, and never transcoded. We do not have the file -- it
        is fetched from the origin site on demand -- so there is nothing local
        to feed a transcoder, and claiming otherwise would have the client ask
        for an HLS variant this app cannot produce for these.
    */
    source.SupportsDirectStream = true;
    source.SupportsDirectPlay = true;
    source.SupportsTranscoding = false;
    source.TranscodingUrl = null;

    return source;
}

/**
 * Send a native player asking for a direct video to the route that serves it.
 *
 * Needed because the client BUILDS this URL itself: ExternalPlayer and
 * ExoPlayer both call `videosApi.getVideoStreamUrl()` rather than using any
 * URL the MediaSource carried, so `/Videos/{id}/stream` is what they request
 * no matter what PlaybackInfo said. Answering with a redirect keeps a single
 * implementation of direct playback (range requests, the octet-stream
 * content-type fix) in `/direct-play` instead of a second copy here.
 *
 * The redirect is deliberately relative-rooted: it must stay on whatever
 * origin the player was already talking to, which behind the multiplexer is
 * NOT this app's own configured ORIGIN.
 */
function directStreamRedirect(guid: string): Response | null {
    const token = fromDirectGuid(guid);
    if (token === null) return null;

    const grant = resolveDirectToken(token);
    if (!grant) return notFound();

    // The token in the path is the whole authorisation, exactly as it is for
    // a link handed to an external app, so no session check applies here.
    return new Response(null, {
        status: 302,
        headers: { location: directStreamPath(token, grant.title) }
    });
}

/** The direct-play URL a native player should fetch for this token. */
function directStreamPath(token: string, title: string): string {
    const label =
        (title || "video")
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .slice(0, 60) || "video";

    return `/direct-play/${token}/${label}.mp4`;
}

async function itemDetailResponse(event: Ctx, guid: string): Promise<Response> {
    const directToken = fromDirectGuid(guid);

    if (directToken !== null) {
        const grant = resolveDirectToken(directToken);
        if (!grant) return notFound();
        return json(directItemDto(guid, grant.title));
    }

    const rivenId = fromGuid(guid);
    if (rivenId === null) return notFound();

    const item = await fetchItem(event, rivenId);
    if (!item) return notFound();

    const playback = await fetchPlaybackInfo(event, rivenId);
    const userId = progressUserId();

    return json(
        await baseItem(
            item,
            playback ? { container: playback.container, durationSeconds: playback.durationSeconds } : null,
            userId ? getProgress(userId, rivenId) : null
        )
    );
}

async function playbackInfoResponse(event: Ctx, guid: string): Promise<Response> {
    requireAuth(event, event.locals.apiKey);

    const directToken = fromDirectGuid(guid);

    if (directToken !== null) {
        const grant = resolveDirectToken(directToken);
        if (!grant) return notFound();

        return json({
            MediaSources: [directSourceDto(guid, grant.title)],
            PlaySessionId: randomUUID().replace(/-/g, "")
        });
    }

    const rivenId = fromGuid(guid);
    if (rivenId === null) return notFound();

    const item = await fetchItem(event, rivenId);
    if (!item) return notFound();

    const playback = await fetchPlaybackInfo(event, rivenId);
    const token = identity.issueToken(event.locals.apiKey);

    const source = mediaSourceDto(toGuid(rivenId), item.title, playback?.container ?? null, playback?.durationSeconds ?? null);

    // Mirrors the backend's former decision: reusing this app's existing
    // playback_info endpoint (browser-capability based, not per-client -- see
    // the frontend AGENTS.md for why the richer DeviceProfile negotiation
    // did not make the trip) rather than reimplementing it.
    if (!playback || playback.mode === "direct") {
        source.SupportsDirectStream = true;
        source.TranscodingUrl = null;
    } else {
        source.SupportsDirectStream = false;
        source.TranscodingUrl = `/Videos/${guid}/main.m3u8?api_key=${token}&MediaSourceId=${guid}`;
        source.TranscodingSubProtocol = "hls";
        source.TranscodingContainer = "ts";
    }

    // A bare decimal string here (the old behavior) is shaped exactly like
    // the tail of one of our GUIDs once zero-padded, and real Jellyfin's own
    // PlaySessionId is an opaque, unrelated random token -- never derived
    // from the item id. Generating a real random id here removes any chance
    // of it later being reinterpreted as one.
    return json({ MediaSources: [source], PlaySessionId: issuePlaySession(rivenId) });
}

async function dispatch(event: Ctx): Promise<Response> {
    if (!jellyfinEnabled()) return notFound();

    const pathname = "/" + (event.params.jellyfin || "");

    /*
        HEAD is answered by the matching GET route with the body dropped.

        Nothing here registers HEAD explicitly, so every HEAD used to 404 --
        including on `/Videos/{id}/stream`, which real Jellyfin answers. That
        matters: ffmpeg (so MX Player, VLC, mpv) probes with HEAD before
        opening a URL, and a 404 there costs a failed request and a retry on
        every single playback start, against a debrid link where one round
        trip is ~0.5s.
    */
    const method = event.request.method === "HEAD" ? "GET" : event.request.method;

    for (const candidate of ROUTES) {
        if (candidate.method !== method) continue;

        const match = pathname.match(candidate.pattern);
        if (!match) continue;

        const response = await candidate.handler(event, match);

        if (event.request.method !== "HEAD") return response;

        /*
            Headers are kept -- content-length and accept-ranges are the whole
            point of the probe -- and the body is cancelled rather than left
            dangling, so the upstream fetch is not held open.
        */
        void response.body?.cancel();

        return new Response(null, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        });
    }

    return notFound();
}

export const GET: RequestHandler = (event) => dispatch(event);
export const POST: RequestHandler = (event) => dispatch(event);
export const HEAD: RequestHandler = (event) => dispatch(event);
