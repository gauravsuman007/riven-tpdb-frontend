/**
 * Keep a detail page's library state in step with the pipeline.
 *
 * A request moves through Requested -> Indexed -> Scraped -> Downloaded ->
 * Completed over seconds to minutes. The page loads its state once, so without
 * this the button sits on whatever was true at first paint and the user has to
 * reload to discover the title finished -- which reads as "nothing happened".
 *
 * Deliberately a poll rather than a subscription: the backend's event stream
 * carries pipeline-wide traffic, and a detail page cares about exactly one
 * title. Polling stops as soon as the item reaches a resting state, so an idle
 * page costs nothing.
 */

import { invalidateAll } from "$app/navigation";
import type { StateDisplay } from "./item-state";

/** Long enough not to hammer the backend, short enough to feel live. */
const INTERVAL_MS = 6000;

/**
 * Refresh page data while `status` reports work in progress.
 *
 * `pending` covers the gap right after requesting, when the item has been
 * queued but no library row exists yet -- there is no status to inspect, and
 * that is exactly when the user is watching.
 */
export function liveState(getStatus: () => StateDisplay | null, getPending: () => boolean) {
    $effect(() => {
        const status = getStatus();
        const active = getPending() || (status ? status.inProgress || !status.available : false);

        if (!active) return;

        let stopped = false;

        const timer = setInterval(() => {
            // invalidateAll re-runs the load, which re-reads library_states.
            if (!stopped) void invalidateAll();
        }, INTERVAL_MS);

        return () => {
            stopped = true;
            clearInterval(timer);
        };
    });
}
