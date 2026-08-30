# riven-tpdb-frontend — agent notes

## App PIN / lockscreen

A per-user 4-digit code that covers the UI after inactivity. Set on the General
settings tab; PIN and timeout in `app_lock` (frontend DB), verification in
`lib/server/app-lock.ts`, and everything else in
`lib/components/app-lock-guard.svelte`.

- **It is an in-page OVERLAY, not a redirect, and this is not negotiable.** It
  used to be a hook that answered 303 to a standalone `/lock` page, which is
  stricter -- a locked browser was never *sent* the content. It also broke the
  Jellyfin clients outright: `JellyfinWebViewClient` only counts itself
  connected when it sees a request for `main.*.bundle.js`, the lock page is
  outside the layout that emits that tag, and so locking dropped the client
  back to "Connect to Server -- connection cannot be established", losing the
  session. Do not reintroduce a lock page or any navigation on lock/unlock.
- **It is a screen lock, NOT an auth factor.** The person it guards against is
  holding a browser that already has a valid session, and the overlay hides
  content that has already been sent. Four digits could never be an auth
  boundary, and the UI says so. Do not "harden" it into one.
- **The backend is not involved.** No scopes, no `/api/v1` gating, no
  server-side enforcement. The one server call left is `POST /api/lock/unlock`,
  which needs the hash.
- **The idle clock is a localStorage stamp compared against `Date.now()`** --
  never a running timer and never the server's clock. That is what makes it
  survive the WebView being frozen or the process being killed: on the way
  back the elapsed time is simply read. Key `riven.applock`, shared with the
  inline head script below.
- **The cover is painted by an inline `<head>` script** (`injectAppLockCover`
  in `hooks.server.ts`), not by the component. A page restored from a killed
  background process paints its content and *then* hydrates, so a component
  overlay arrives a frame or two after the thing it is meant to hide. A
  synchronous head script sets `data-app-locked` on `<html>` before `<body>`
  is parsed. The component adopts that decision rather than re-deriving it.
- **The head script must never run on `/auth/*`.** The guard only mounts inside
  the protected layout, so an auth page carrying the attribute would hide its
  own body with nothing to unhide it -- a blank, unusable login screen.
- **The overlay is moved to be a direct child of `<body>` on mount**, because
  the cover stylesheet hides `body > *` and the component renders deep inside
  the layout.
- **Playback counts as activity**, captured on the document (media events do
  not bubble): a two-hour film with nobody touching the screen must not lock.
- Unlock is throttled (5 attempts, then a cooldown): four digits is 10,000
  possibilities and the premise is that the attacker already has the device.

## Jellyfin-compatible surface

Implemented here (`src/routes/[...jellyfin]/+server.ts`, `src/lib/server/jellyfin/`,
`src/lib/utils/jellyfin-ids.ts`), not in the backend. It used to live in the
Python backend as a reverse proxy in front of this app's own pages; every bug
that produced (SvelteKit's CSRF check pinning a fixed `ORIGIN`, a login
response's three `Set-Cookie` headers collapsing into one malformed value
going through a hand-rolled proxy) came from bridging two independently
configured origins by hand. Moving the whole protocol here — where the real
pages and the Jellyfin surface are naturally the same origin — removed the
bridge instead of patching it again. See `riven-tpdb`'s `AGENTS.md` for that
history if it's ever relevant again.

- **Config is env-only** (`lib/server/jellyfin/config.ts`): `JELLYFIN_ENABLED`,
  `JELLYFIN_SERVER_NAME`, `JELLYFIN_USERNAME`. No settings-form entry exists
  for this — restart to change one. Password is always `BACKEND_API_KEY`; there
  is deliberately no second credential store.
- **The client split that matters is WebView shell vs native**, not official
  vs third-party. Jellyfin for Android (mobile, official) and the LG webOS app
  are WebView shells with no UI of their own: they validate the server, then
  load one from it. Jellyfin for Android **TV**, Swiftfin, and Findroid build
  their own UI from the API and need nothing this file serves at `/`.
- **Case-insensitive routing is required.** Jellyfin's own server is ASP.NET,
  whose routing is case-insensitive, and real clients rely on it (probing
  `/system/info/public`, not `/System/Info/Public`). The catch-all's `route()`
  helper compiles every path with the `i` flag for exactly this reason. Route
  order matters within `ROUTES`: `/Users/AuthenticateByName`, `/Users/Me`, and
  `/Users/Public` are tried before the `/Users/{userId}` pattern.
- **The connection trigger is a URL PATH match, not a real bundle.** Reading
  `jellyfin-android` (GPL) rather than guessing:
  `JellyfinWebViewClient.shouldInterceptRequest()` calls
  `onConnectedToWebapp()` the instant it sees a request whose path matches
  "main.\<anything\>.bundle.js" (`Constants.MAIN_BUNDLE_PATH_REGEX`) — the
  response body is never inspected. `BUNDLE_PATH` in
  `lib/server/jellyfin/bundle.ts` IS that path; renaming it breaks both
  WebView clients silently (a spinner, then a 10s timeout, no error). Every
  HTML page must reference it, which is what `injectJellyfinBundle` in
  `hooks.server.ts` does via `transformPageChunk`.
- **The native player reads its token from OUR OWN localStorage**:
  `jellyfin_credentials` → `Servers[0].{UserId,AccessToken}` — but it does
  NOT read it proactively. Confirmed by reading
  `JellyfinWebViewClient.shouldInterceptRequest()`: it imports the token
  into the app's native session (`mainViewModel.setupUser(...)`) only at the
  moment it intercepts a request whose path ends in
  `sessions/capabilities/full`, which is real jellyfin-web's own post-login
  startup call. Our page has no other reason to make that request, and
  without it every native API call goes out with the pre-login
  `MediaBrowser Client="...", Version="..."` header and NO `Token=` — a
  silent 401 storm with no visible error. `bundle.ts` therefore POSTs to
  that path itself once credentials exist. Do not remove that call.
- **TRAP, and it broke BOTH native players at once: never trust an existing
  `jellyfin_credentials`.** Behind jellyfin-client-multiplexer -- which is how
  the Jellyfin clients actually reach this app -- that key is ALREADY populated
  at this origin, with the multiplexer's own random per-boot `ACCESS_TOKEN`:
  it answers `/Users/AuthenticateByName` itself and its picker page seeds the
  result (`picker.ts`, `mux-token`). `ensureCredentials` preferred it, so the
  multiplexer's token went into the native session and every native call
  carried a token this app has never heard of. On-device (Jellyfin Android
  2.7.1, adb logcat):

      E/MediaSourceResolver: Failed to load media source 0000...035e
      InvalidStatusException: Invalid HTTP status in response: 401

  ExoPlayer and the external player failed identically because both resolve
  the media source through the same `ApiClient` before they diverge. The
  `/web/session-token` exchange is therefore UNCONDITIONAL; a stored
  credential is only a fallback for when there is no session to exchange.
- **The minted token is claimed with the multiplexer** (`POST
  /__mux/claim-token`). The native player is a separate HTTP stack from the
  WebView, so its requests carry no `mux_device` cookie and the token is the
  only thing left to route them by -- and the multiplexer only learns tokens
  by watching AuthenticateByName responses, which this one never produces.
  Without it, routing falls through to "whichever app was last active".
- **The LG webOS client's handshake has TWO steps, and the second is
  `/web/manifest.json`.** From jellyfin-webos `frontend/js/index.js`: the
  success handler for `/System/Info/Public` immediately calls `getManifest()`,
  and a 404 there lands in `handleFailure` -- "Got HTTP error 404 from server,
  are you connecting to a Jellyfin Server?" -- with no further request ever
  made. `start_url` is resolved as `baseurl + "/web/" + start_url`, so
  `"index.html"` sends the client to `/web/index.html`, which redirects to the
  app. The Android client never asks for either, which is why only webOS
  failed and why this went unnoticed for so long.
- **`openUrl()` can never reach a media player on modern Android.** It fires
  `ACTION_VIEW` with no MIME type, and an http URI with no type is a WEB
  intent: only verified link handlers are candidates, so a media player is
  excluded from the chooser however the path ends -- a `.mp4` extension does
  not rescue it (tried; logcat showed Android resolving straight to Firefox
  with no `typ=`). The typed intent is the only route, and it is always
  available: `WebViewFragment.kt:188-191` registers all four bridges
  unconditionally and `ExternalPlayer.initPlayer()` has NO `isEnabled()` gate
  -- only `isEnabled()` reads the player preference. So
  `RivenNative.openInExternalPlayer()` works even when the client's default is
  the web player, which is the only time that button is on screen.
- **TRAP, cost the longest debugging cycle in this feature's history**:
  `toGuid()` silently mis-encodes a STRING id. The backend serialises
  `MediaItem.id` as a string (`"862"`), and `String.prototype.toString()`
  takes no radix argument and *ignores* one, so `("862").toString(16)`
  returns `"862"` rather than `"35e"`. The decimal id then zero-pads into a
  perfectly valid-looking GUID that decodes as a completely different item
  (862 -> `...000862` -> 2146), and every request for it 404s with nothing
  in the error hinting at an encoding problem — it looks exactly like a
  stale client cache, which is what it was misdiagnosed as, twice.
  `toGuid` now coerces with `Number()` and throws on anything unusable;
  keep it that way, because TypeScript cannot enforce the declared `number`
  type across an HTTP boundary.
- **The OpenAPI spec is NOT the authority on required fields.** Its
  `required` arrays are almost entirely empty, so it will call a response
  valid that a real client rejects outright. jellyfin-android deserializes
  via jellyfin-sdk-kotlin, where a field is required iff its generated data
  class declares it *without a default*; a missing key throws
  `MissingFieldException` and aborts playback with no useful client-side
  error (the server sees a clean 200). `scripts/jellyfin-required-fields.py`
  reads those generated models and diffs them against live responses —
  run it after changing any DTO shape instead of discovering fields one at
  a time from device logcat, which is how `MediaSourceInfo`,
  `UserConfiguration` and `UserPolicy` were each found the hard way.
- **Debugging the native client: `adb logcat` is the only real signal.**
  The failures above are invisible server-side (200s all round) and
  invisible in `chrome://inspect` (that shows only the WebView's JS
  console, not native Kotlin). Filter on
  `MediaSourceResolver|PlayerViewModel|ExoPlayer|riven-native`.
- **`window.NativePlayer.loadPlayer()` takes item IDs, not URLs.** ExoPlayer
  resolves the stream itself via `/Items/{id}/PlaybackInfo` and
  `/Videos/{id}/stream`. `video-player.svelte` checks
  `window.RivenNative?.available()` at the top of its `onMount` and, when
  true, hands off to the native player instead of setting up the in-page
  `<video>` element at all — ExoPlayer takes over as a native overlay outside
  this component's DOM. **The overlay must never open in the first place**:
  `player.svelte.ts`'s `open()`/`openDirect()` now check
  `window.RivenNative?.available()` themselves and hand off directly,
  without ever setting `player.current` — the popup used to still mount
  with an empty `<video>` (no src, showing a bare play button) underneath
  the native player, and its `touch-action:none` seek/zoom stage ate the OS
  edge-swipe-back gesture for a player the user couldn't see. A direct-site
  video plays through a bare native `<video>` +
  `webkitEnterFullscreen()`/`requestFullscreen()` in that same code path,
  bypassing the custom overlay entirely so the OS back gesture still works.
  (It no longer lacks an id — see the direct-video bullet below — but this
  in-page path is still what runs when no native player is selected.)
- **A direct-site video HAS an id now — that is what makes external players
  work.** Previously it had none, so "open in external player" fell back to
  `NativeInterface.openUrl()`, which reaches Android as
  `Intent(ACTION_VIEW, uri)` with **no MIME type set**. Android then resolves
  an http URL by scheme alone and a browser always wins, so the media-player
  chooser was never offered — reported as "it opens the video in the browser
  and skips the player selection dialog". Reading `ExternalPlayer.kt`, the
  bridge that builds the intent with `setDataAndType(uri, "video/*")` — the
  thing that makes the chooser appear — is `initPlayer()`, and it takes
  **item ids**; there is no entry point on it that accepts a raw URL. So the
  fix is an id, not a better URL. `toDirectGuid()` mints one from the
  direct-play token, and the Jellyfin surface answers for it at
  `/Items/{id}`, `/Items/{id}/PlaybackInfo` and `/Videos/{id}/stream`. That
  last one matters: both native players **build the stream URL themselves**
  via `videosApi.getVideoStreamUrl()` rather than using anything the
  MediaSource carried, so answering only PlaybackInfo is not enough. The same
  change is what makes the in-app ExoPlayer work for direct videos at all.
- **`fromGuid()` must reject EVERY reserved prefix, not just one.** It checked
  only `SYNTHETIC_PREFIX`, so any second namespace fell through to
  `parseInt(hex, 16)` and decoded as an enormous but perfectly finite number —
  a valid-looking MediaItem id for a row that cannot exist, which 404s with
  nothing pointing at the encoding as the cause. Direct-play tokens are 24 hex
  chars precisely because the token **is** the id: 8 for the prefix, 24 left.
- **Behind the multiplexer, the WebView and the video fetcher are different
  HTTP clients.** ExoPlayer and the external-player handoff run in Kotlin,
  outside the WebView, with their own HTTP client and **no cookie jar**. Any
  proxy that routes on a browser cookie will 404 every `PlaybackInfo` and
  every stream request while the UI itself works perfectly — which is exactly
  how it presented. They do carry the Jellyfin access token, so that is the
  only usable routing key for them. Fixed in `jellyfin-client-multiplexer`,
  not here, but worth knowing before debugging playback that works direct and
  fails proxied.
- **Video delivery is a thin proxy, not a reimplementation.** `/Videos/{id}/stream`,
  `/Videos/{id}/main.m3u8`, and the HLS segment routes call the backend's
  existing `/api/v1/stream/file|playback_info|hls/...` endpoints directly —
  the same ones the browser player already uses. Range handling, debrid link
  resolution, and HLS transcode sessions only exist in Python; reimplementing
  them in Node would be a much larger, separate project. Accepted
  simplification: `PlaybackInfo` here uses the backend's fixed
  browser-capability probe rather than negotiating against the client's own
  `DeviceProfile` (which the old backend implementation did) — a real
  regression against a genuinely capable native client, traded for not
  reimplementing that negotiation logic in TypeScript. Revisit if a native
  client turns out to need it.
- **TRAP, cost a real debugging cycle**: `Response.redirect(url, 302)`
  returns a Response whose `Headers` object has `guard: "immutable"`.
  SvelteKit's own hook chain tries to `headers.append()` a `Set-Cookie` onto
  *every* outgoing response (this app sets a `tvdb_cookie` on demand in
  `hooks.server.ts`), and appending to an immutable Headers object throws
  `TypeError: immutable`, turning any such redirect into a bare 500 with no
  useful message client-side. Found by an actual end-to-end test (real
  Postgres + built backend + built frontend, not just `svelte-check`) hitting
  `Items/{id}/Images/{type}`, which redirects to the poster CDN URL. Fix used
  throughout this router: `new Response(null, { status: 302, headers: {
  location: url } })` — a plain object literal headers argument produces a
  normal, mutable Headers object. Never use the `Response.redirect()` /
  `Response.json()` static helpers anywhere a cookie-setting hook might also
  touch the response.
- Discovery (UDP 7359) was **not** ported here either. It never worked on the
  production deployment regardless of which process ran it — the container is
  bridge-networked, so LAN broadcast can't reach it, and `network_mode: host`
  would collide with the real Jellyfin already on 7359/8096 on that host.
  Clients must be added by address.
