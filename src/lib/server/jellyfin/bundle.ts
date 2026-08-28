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
 * 2. The native layer reads its own API token out of OUR localStorage:
 *    `jellyfin_credentials` -> `Servers[0].{UserId,AccessToken}`.
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

  function nativeAvailable() {
    try { return !!(window.NativePlayer && window.NativePlayer.isEnabled()); }
    catch (e) { return false; }
  }

  // Exchanges the browser's own session cookie (the human already signed in
  // through the real login page) for the native player's token, so there is
  // no separate credential prompt inside the WebView.
  function ensureCredentials(done) {
    if (creds()) { done(true); return; }
    if (!nativeAvailable()) { done(false); return; }

    fetch("/web/session-token", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) { done(false); return; }
        window.localStorage.setItem(CRED_KEY, JSON.stringify({
          Servers: [{ Id: d.ServerId, UserId: d.UserId, AccessToken: d.AccessToken }]
        }));
        done(true);
      })
      .catch(function () { done(false); });
  }

  // What the player component calls. \`itemId\` is the Jellyfin item id (32
  // hex), derived from the Riven item id the same way the API routes do.
  window.RivenNative = {
    available: nativeAvailable,
    play: function (itemId, startPositionTicks) {
      if (!nativeAvailable()) return false;

      ensureCredentials(function (ok) {
        if (!ok) return;
        window.NativePlayer.loadPlayer(JSON.stringify({
          ids: [itemId],
          startIndex: 0,
          startPositionTicks: startPositionTicks || 0
        }));
      });

      return true;
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
