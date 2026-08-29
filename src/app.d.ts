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
            /** Hands a raw media URL to the OS chooser, bypassing Jellyfin. */
            openExternal: (url: string) => boolean;
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
