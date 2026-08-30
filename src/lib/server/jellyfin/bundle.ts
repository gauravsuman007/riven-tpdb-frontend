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

  /**
   * The shell bridge that owns openUrl, fullscreen and client settings.
   *
   * "NativeInterface" is the real one: WebViewFragment.kt:188 registers
   * exactly four JavascriptInterfaces -- NativeInterface, NativePlayer,
   * ExternalPlayer, MediaSegments -- and NativeShell is NOT among them.
   * NativeShell is a plain JS object that jellyfin-web itself defines and
   * layers over NativeInterface, so it exists only when the real jellyfin-web
   * is being served. We serve this bundle in its place, so it never does.
   *
   * That was a real, silent bug: every call guarded on window.NativeShell
   * returned false forever, which made "open in external player" do nothing
   * at all and sent direct-site videos to the in-page overlay even with an
   * external player selected. NativeShell is still preferred when present so
   * this keeps working if these pages are ever loaded by a shell that does
   * define it.
   */
  function shell() {
    try {
      if (window.NativeShell && window.NativeShell.openUrl) return window.NativeShell;
      if (window.NativeInterface) return window.NativeInterface;
    } catch (e) {}
    return null;
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

  /**
   * Put OUR token in localStorage and hand it to the native session.
   *
   * The exchange is unconditional, and that is the whole point. When these
   * pages are reached through the multiplexer -- which is how the Jellyfin
   * clients reach them -- 'jellyfin_credentials' is ALREADY populated at
   * this origin, and populated with the wrong token: the multiplexer answers
   * '/Users/AuthenticateByName' itself and hands the client a random
   * per-boot 'ACCESS_TOKEN' of its own, then its picker page seeds that into
   * localStorage (picker.ts, 'mux-token'). Same origin, so it is the very
   * value 'creds()' reads.
   *
   * Trusting it meant importing the multiplexer's token into the native
   * session, after which every native call -- PlaybackInfo, /Videos/stream
   * -- carried a token this app has never heard of. Confirmed on-device:
   *
   *   E/MediaSourceResolver: Failed to load media source 0000...035e
   *   InvalidStatusException: Invalid HTTP status in response: 401
   *
   * and then the toast from ExternalPlayer.initPlayer. It broke ExoPlayer and
   * the external player identically, because both resolve the media source
   * through the same ApiClient before they diverge.
   *
   * A pre-existing credential is therefore never preferred, only used as a
   * fallback for the case this was originally written for: a shell that
   * seeded a REAL token for this server before loading the page, with our
   * own session cookie unavailable.
   */

  /*
      Upsert OUR server entry, keeping everyone else's.

      'jellyfin_credentials' is a per-ORIGIN store, and behind the
      multiplexer every app -- a real Jellyfin server proxied through it
      included -- shares one origin. Replacing the array wholesale was
      therefore deleting Jellyfin's saved login every time any other page at
      this origin loaded. That is exactly why signing in to Jellyfin, going
      back to the picker and opening it again asked for a password: the
      picker page itself did the deleting, on the way in.

      Ours goes FIRST, so anything reading Servers[0] still reads ours and
      not a neighbour's.
  */
  function writeCredentials(entry) {
    var others = [];

    try {
      var existing = JSON.parse(window.localStorage.getItem(CRED_KEY));
      if (existing && existing.Servers && existing.Servers.length) {
        others = existing.Servers.filter(function (s) { return s && s.Id !== entry.Id; });
      }
    } catch (e) {}

    try {
      window.localStorage.setItem(CRED_KEY, JSON.stringify({ Servers: [entry].concat(others) }));
    } catch (e) { log("could not write credentials", e); }
  }

  function ensureCredentials(done) {
    if (nativeSessionImported) { done(true); return; }

    fetch("/web/session-token", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) log("/web/session-token returned", r.status);
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d) {
          // No session to exchange. Only now is whatever is already stored
          // worth a try -- it may be a real token from a different shell,
          // and it is certainly better than giving up silently.
          if (creds()) { log("no session token; falling back to stored credentials"); importIntoNativeSession(done); return; }
          done(false);
          return;
        }

        writeCredentials({ Id: d.ServerId, UserId: d.UserId, AccessToken: d.AccessToken });

        claimTokenWithHost(d.AccessToken);
        importIntoNativeSession(done);
      })
      .catch(function (e) { log("session-token fetch failed", e); done(false); });
  }

  /**
   * Tell the multiplexer, if we are behind one, which app this token belongs
   * to.
   *
   * The native player is a separate HTTP stack from the WebView, so its
   * requests carry no 'mux_device' cookie and the multiplexer can only route
   * them by access token (index.ts, 'appForToken'). It learns tokens by
   * watching AuthenticateByName responses go past, which never happens for
   * this token -- we mint it over a session cookie instead. Without this the
   * routing falls through to "whichever app was last active", which is
   * usually right and quietly wrong the moment it is not.
   *
   * Best-effort by design: a plain browser, or a multiplexer without this
   * endpoint, just 404s and nothing here depends on the result.
   */
  function claimTokenWithHost(token) {
    try {
      fetch("/__mux/claim-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token })
      }).catch(function () {});
    } catch (e) {}
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

    /**
     * Hand a RAW video URL straight to the OS, bypassing Jellyfin entirely.
     *
     * For direct-site videos there is no library item, so ExternalPlayer's
     * own entry point cannot be used: initPlayer() takes item ids and
     * resolves them through PlaybackInfo, which only exists for things in
     * the library. shell().openUrl() instead fires a plain
     * Intent(ACTION_VIEW, uri) (ActivityEventHandler.kt:68-72), so Android
     * offers whatever video players are installed and the chosen one gets
     * nothing but the URL -- no session, no token, no dependency on the
     * Jellyfin app still running.
     */
    externalPlayerSelected: externalAvailable,

    openExternal: function (url) {
      var host = shell();
      if (!host || !host.openUrl) { log("no shell bridge for openUrl"); return false; }

      try {
        host.openUrl(url);
        return true;
      } catch (e) {
        log("openUrl failed", e);
        return false;
      }
    },

    /**
     * Play a direct-site video through whichever NATIVE player is selected.
     *
     * Preferred over openExternal() for anything that is actually a video.
     * openUrl() reaches Android as Intent(ACTION_VIEW, uri) with no MIME type
     * (ActivityEventHandler.kt), so an http URL matches browsers by scheme and
     * the media-player chooser is never offered -- reported exactly that way:
     * the video opened in the browser instead. ExternalPlayer.initPlayer()
     * builds the same intent with setDataAndType(uri, "video/*"), which is
     * what makes the chooser appear, and it takes an ITEM ID -- hence the
     * server minting one for these videos (see toDirectGuid).
     *
     * Going through the id also means the in-app ExoPlayer works for direct
     * videos for the first time: the same call serves both player types, the
     * way it already did for library items.
     */
    /**
     * Open one video in an EXTERNAL app, whatever the client's default is.
     *
     * ExternalPlayer.initPlayer() has no isEnabled() gate -- checked in
     * WebViewFragment.kt, which registers all four bridges unconditionally,
     * and in ExternalPlayer.kt, where only isEnabled() reads the preference.
     * So the external hand-off can be invoked even when the human has chosen
     * the web player, which is exactly when this is wanted: the in-page
     * player is on screen and they are asking to send THIS video elsewhere.
     *
     * The alternative, openUrl(), cannot do it. It fires ACTION_VIEW with no
     * MIME type, and on modern Android an http URI with no type is a WEB
     * intent: only verified link handlers are candidates, so media players
     * are excluded from the chooser no matter what the path ends in.
     * Reported twice as "it opens in the browser", and logcat showed
     * Android resolving straight to Firefox with no typ= on the intent.
     * initPlayer() builds setDataAndType(uri, "video/*") instead, which is
     * not a web intent and does offer the players.
     */
    openInExternalPlayer: function (itemId) {
      var bridge = null;

      try { bridge = window.ExternalPlayer && window.ExternalPlayer.initPlayer ? window.ExternalPlayer : null; }
      catch (e) {}

      if (!bridge) { log("no ExternalPlayer bridge"); return false; }

      ensureCredentials(function (ok) {
        if (!ok) { log("openInExternalPlayer aborted: no credentials"); return; }

        try {
          bridge.initPlayer(JSON.stringify({ ids: [itemId], startIndex: 0, startPositionTicks: 0 }));
        } catch (e) {
          log("initPlayer failed", e);
        }
      });

      return true;
    },

    playDirect: function (itemId) {
      if (!nativeAvailable()) { log("playDirect() called but no native player"); return false; }

      ensureCredentials(function (ok) {
        if (!ok) { log("playDirect() aborted: no credentials for native player"); return; }

        var options = JSON.stringify({ ids: [itemId], startIndex: 0, startPositionTicks: 0 });

        if (externalAvailable()) window.ExternalPlayer.initPlayer(options);
        else window.NativePlayer.loadPlayer(options);
      });

      return true;
    },

    /**
     * Ask the ANDROID ACTIVITY to go fullscreen, which the Fullscreen API
     * cannot do from inside a WebView.
     *
     * requestFullscreen() only ever expands an element within the WebView's
     * own viewport -- the activity's status bar is outside that viewport
     * entirely, so it stays on screen no matter what the page does. Only
     * the native side can hide it, via ChangeFullscreen
     * (ActivityEventHandler.kt:48-60), which also locks to landscape.
     *
     * Returns whether the bridge accepted it, so the caller can still run
     * the ordinary web fullscreen path in a plain browser.
     */
    enableFullscreen: function () {
      var host = shell();
      if (!host || !host.enableFullscreen) return false;

      try { host.enableFullscreen(); return true; }
      catch (e) { log("enableFullscreen failed", e); return false; }
    },

    disableFullscreen: function () {
      var host = shell();
      if (!host || !host.disableFullscreen) return false;

      try { host.disableFullscreen(); return true; }
      catch (e) { log("disableFullscreen failed", e); return false; }
    },

    // Opens the app's own settings screen, where the player type above is
    // chosen. This is the only way to reach those preferences: they are
    // native, per-device, and have no server-side representation, so a
    // server cannot set them on the client's behalf.
    settingsAvailable: function () {
      var host = shell();
      return !!(host && host.openClientSettings);
    },

    openSettings: function () {
      var host = shell();
      if (!host || !host.openClientSettings) return false;

      try { host.openClientSettings(); return true; }
      catch (e) { log("openClientSettings failed", e); return false; }
    },

    /**
     * Send the client back to its own "choose a server" screen.
     *
     * The only way out of this app when the client is pointed straight at it.
     * Signing out lands on this app's login page, which inside the WebView is
     * a dead end: there is no address bar, no back gesture out of the web
     * content, and no other route to the client's server list. Reported
     * exactly that way.
     *
     * NativeInterface.openServerSelection() (NativeInterface.kt:177) is what
     * the client itself uses for this.
     */
    serverSelectionAvailable: function () {
      var host = shell();
      return !!(host && host.openServerSelection);
    },

    openServerSelection: function () {
      var host = shell();
      if (!host || !host.openServerSelection) return false;

      try { host.openServerSelection(); return true; }
      catch (e) { log("openServerSelection failed", e); return false; }
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
