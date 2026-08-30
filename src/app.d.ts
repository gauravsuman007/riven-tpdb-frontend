// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const __APP_VERSION__: string;

declare global {
    namespace App {
        interface Locals {
            user: import("$lib/server/auth").SessionValidationResult["user"];
            session: import("$lib/server/auth").SessionValidationResult["session"];
            backendUrl: string;
            apiKey: string;
        }
    }

    // Navigator User-Agent Client Hints API
    interface NavigatorUABrandVersion {
        readonly brand: string;
        readonly version: string;
    }

    interface NavigatorUAData {
        readonly platform: string;
        readonly mobile: boolean;
        readonly brands: ReadonlyArray<NavigatorUABrandVersion>;
    }

    interface Navigator {
        readonly userAgentData?: NavigatorUAData;
    }

    // Bridge injected by lib/server/jellyfin/bundle.ts into the Jellyfin
    // WebView shells (official Android app, LG webOS). Undefined everywhere
    // else -- a normal browser never has this.
    interface Window {
        RivenNative?: {
            /** False when the human chose the "webui" player: use our own. */
            available: () => boolean;
            play: (itemId: string, startPositionTicks?: number) => boolean;
            /** True when the human chose "external" (VLC/MX Player). */
            externalPlayerSelected: () => boolean;
            /**
             * Hands a raw media URL to the OS, bypassing Jellyfin.
             *
             * Cannot produce a media-player chooser: the intent carries no
             * MIME type, so Android resolves an http URL by scheme and a
             * browser wins. Prefer `playDirect` and keep this as the fallback
             * for a shell with no player bridge.
             */
            openExternal: (url: string) => boolean;
            /**
             * Plays a video by Jellyfin item id through whichever native
             * player is selected. This is the path that produces a chooser,
             * because ExternalPlayer.initPlayer() sets the "video/*" type.
             * False when no native player bridge is enabled.
             */
            playDirect: (itemId: string, done?: (ok: boolean) => void) => boolean;
            /**
             * Sends one video to an external app regardless of the client's
             * default player. False only when the shell exposes no
             * ExternalPlayer bridge.
             */
            openInExternalPlayer: (itemId: string, done?: (ok: boolean) => void) => boolean;
            /**
             * Asks the native activity to hide the system UI and lock to
             * landscape. Returns false outside the shell, where the ordinary
             * Fullscreen API is the right path instead.
             */
            enableFullscreen: () => boolean;
            disableFullscreen: () => boolean;
            /**
             * Whether the client can be sent back to its server-selection
             * screen. False outside the Jellyfin shell.
             */
            serverSelectionAvailable: () => boolean;
            openServerSelection: () => boolean;
            /** Whether this shell can open its own native settings screen. */
            settingsAvailable: () => boolean;
            /** Opens them -- where the player type (web/integrated/external) lives. */
            openSettings: () => boolean;
        };
    }
}

export {};
