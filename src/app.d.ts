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
            available: () => boolean;
            play: (itemId: string, startPositionTicks?: number) => boolean;
        };
    }
}

export {};
