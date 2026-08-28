/**
 * The script served at the path that marks a Jellyfin WebView shell
 * connected, and that bridges its native video player into our pages.
 *
 * Reading `jellyfin-android` (GPL) rather than guessing, the shell's contract
 * is far weaker than "serve the real jellyfin-web":
 *
 * 1. `JellyfinWebViewClient.shouldInterceptRequest()` calls
 *    `onConnectedToWebapp()` the instant it sees a request path shaped like
 *    "main.<anything>.bundle.js" -- the response body is never inspected.
 *    So this script is served AS that bundle: one request both trips the
 *    flag and delivers the code, inside the client's 10s connection timeout.
 *    RENAMING THIS PATH BREAKS BOTH CLIENTS SILENTLY.
 * 2. The native layer does NOT read `jellyfin_credentials` on its own on
 *    every page load. Per `JellyfinWebViewClient.shouldInterceptRequest()`,
 *    it only imports the token into the app's native session (`mainViewModel
 *    .setupUser(...)`) at the moment it intercepts a request whose path ends
 *    in `sessions/capabilities/full` -- the real jellyfin-web client's own
 *    post-login startup call, which evaluates
 *    `JSON.parse(localStorage.getItem('jellyfin_credentials'))` in the
 *    WebView right then. Skip that request (our page has no other reason to
 *    make it) and the native side calls every API -- PlaybackInfo, stream,
 *    Users/Me -- with the pre-login `MediaBrowser Client="...", Version="..."`
 *    header and NO `Token=`, which is a silent 401 with no visible error.
 *    So this script must fire that request itself once credentials exist.
 * 3. `window.NativePlayer.loadPlayer()` takes ITEM IDS, not URLs; ExoPlayer
 *    then resolves the stream itself via `/Items/{id}/PlaybackInfo` and
 *    `/Videos/{id}/stream`.
 *
 * Because the Jellyfin protocol and the real Riven UI now live in the SAME
 * app, the human signs in through the actual login page (a real better-auth
 * session cookie) and this script silently exchanges that session for the
 * native player's token via `/web/session-token` -- no separate API-key
 * prompt, unlike the previous (reverse-proxied) version of this bridge.
 */

export const BUNDLE_PATH = "/web/main.riven.bundle.js";

export const BUNDLE_JS = `
(function () {
  "use strict";

  var CRED_KEY = "jellyfin_credentials";

  function creds() {
    try {
      var c = JSON.parse(window.localStorage.getItem(CRED_KEY));
      if (c && c.Servers && c.Servers[0] && c.Servers[0].AccessToken) return c.Servers[0];
    } catch (e) {}
    return null;
  }

  // The app offers three player types in its OWN native settings
  // (VideoPlayerType: "webui" | "exoplayer" | "external"), and exposes each
  // as a separate JS bridge whose isEnabled() reflects that choice. Exactly
  // one is ever enabled, so asking both is how we learn what the human
  // picked -- there is no API to query the setting directly.
  function exoAvailable() {
    try { return !!(window.NativePlayer && window.NativePlayer.isEnabled()); }
    catch (e) { return false; }
  }

  function externalAvailable() {
    try { return !!(window.ExternalPlayer && window.ExternalPlayer.isEnabled()); }
    catch (e) { return false; }
  }

  // "Should we hand off at all?" -- false means the human chose "webui", so
  // our own in-page player should handle it exactly as it does in a browser.
  function nativeAvailable() {
    return exoAvailable() || externalAvailable();
  }

  // Failures only: this bridge is invisible from the server side, so a
  // silent abort here is very expensive to diagnose (see AGENTS.md).
  function log() {
    try { console.log.apply(console, ["[riven-native]"].concat([].slice.call(arguments))); }
    catch (e) {}
  }

  // Tells jellyfin-android to intercept this exact request and import
  // whatever is in localStorage's jellyfin_credentials into its native
  // session (mainViewModel.setupUser). Path match is case-insensitive and
  // suffix-based on the client's side; the response body is irrelevant --
  // our own router already answers this path with 204.
  var CAPABILITIES_PATH = "/sessions/capabilities/full";
  var nativeSessionImported = false;

  function importIntoNativeSession(done) {
    if (nativeSessionImported) { done(true); return; }

    fetch(CAPABILITIES_PATH, { method: "POST", credentials: "same-origin" })
      .then(function () {
        // The WebView's interception is fire-and-forget on its side (it
        // evaluates JS asynchronously and lets this request proceed
        // regardless), so there is no signal for when setupUser() actually
        // finishes. A short wait here is cheaper than a real race with the
        // very next NativePlayer call.
        setTimeout(function () {
          nativeSessionImported = true;
          done(true);
        }, 250);
      })
      .catch(function (e) { log("sessions/capabilities/full failed", e); done(false); });
  }

  // Exchanges the browser's own session cookie (the human already signed in
  // through the real login page) for the native player's token, so there is
  // no separate credential prompt inside the WebView.
  function ensureCredentials(done) {
    if (creds()) { importIntoNativeSession(done); return; }
    if (!nativeAvailable()) { log("NativePlayer not available, cannot ensure credentials"); done(false); return; }

    // The native client authenticates itself natively (AuthenticateByName is
    // never called from inside this WebView) and, per real Jellyfin, is
    // expected to seed jellyfin_credentials into this WebView's localStorage
    // before it ever loads a page. If that did not happen -- e.g. this
    // client wires its bridge differently -- fall back to exchanging our own
    // better-auth session cookie, which only exists if the human happened to
    // load a real login page in this same WebView.
    fetch("/web/session-token", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) log("/web/session-token returned", r.status);
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d) { done(false); return; }
        window.localStorage.setItem(CRED_KEY, JSON.stringify({
          Servers: [{ Id: d.ServerId, UserId: d.UserId, AccessToken: d.AccessToken }]
        }));
        importIntoNativeSession(done);
      })
      .catch(function (e) { log("session-token fetch failed", e); done(false); });
  }

  // What the player component calls. \`itemId\` is the Jellyfin item id (32
  // hex), derived from the Riven item id the same way the API routes do.
  window.RivenNative = {
    available: nativeAvailable,
    play: function (itemId, startPositionTicks) {
      if (!nativeAvailable()) { log("play() called but NativePlayer unavailable"); return false; }

      ensureCredentials(function (ok) {
        if (!ok) { log("play() aborted: no credentials available for native player"); return; }

        // Both bridges take the same PlayOptions JSON (ids, not URLs); the
        // external one resolves a stream URL and fires an Intent instead of
        // playing in-app.
        var options = JSON.stringify({
          ids: [itemId],
          startIndex: 0,
          startPositionTicks: startPositionTicks || 0
        });

        if (externalAvailable()) window.ExternalPlayer.initPlayer(options);
        else window.NativePlayer.loadPlayer(options);
      });

      return true;
    },

    // Opens the app's own settings screen, where the player type above is
    // chosen. This is the only way to reach those preferences: they are
    // native, per-device, and have no server-side representation, so a
    // server cannot set them on the client's behalf.
    settingsAvailable: function () {
      try { return !!(window.NativeShell && window.NativeShell.openClientSettings); }
      catch (e) { return false; }
    },

    openSettings: function () {
      try { window.NativeShell.openClientSettings(); return true; }
      catch (e) { log("openClientSettings failed", e); return false; }
    }
  };

  if (nativeAvailable()) {
    document.documentElement.setAttribute("data-riven-native-player", "1");
    // Warm the token as soon as a session exists, so the first tap on Play
    // doesn't have to wait on the exchange.
    ensureCredentials(function () {});
  }
})();
`;
