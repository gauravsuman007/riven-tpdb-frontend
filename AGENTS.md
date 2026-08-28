# riven-tpdb-frontend — agent notes

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
  `jellyfin_credentials` → `Servers[0].{UserId,AccessToken}`. **Suspected
  wrong assumption, not yet confirmed on-device**: the original design
  assumed the human logs into a real page in this WebView and the bundle
  script exchanges that better-auth session cookie for the token via
  `GET /web/session-token`. But the official Android app's login (server
  add → native username/password screen → `AuthenticateByName`) almost
  certainly happens *natively*, outside any WebView page load — in real
  Jellyfin the native client is the one that SEEDS `jellyfin_credentials`
  into the WebView's localStorage before loading the main page, for
  jellyfin-web (which has no native login of its own) to read. If that's
  what's happening here too, our session-cookie fallback fires because
  `creds()` finds nothing, and it also finds nothing (no session cookie
  exists in that WebView), so `ensureCredentials` silently fails and
  `NativePlayer.loadPlayer()` is never called — matching the observed
  symptom of the native player screen opening but never receiving media.
  `bundle.ts` now logs every step of this path via `console.log("[riven-native]", ...)`
  instead of swallowing failures — check `chrome://inspect` (WebView remote
  debugging over USB) against a real device before changing this further;
  don't guess again without that evidence.
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
  video (no library item, so no ids to hand to `NativePlayer`) instead plays
  through a bare native `<video>` + `webkitEnterFullscreen()`/
  `requestFullscreen()` in that same code path, bypassing the custom overlay
  entirely so the OS back gesture still works.
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
