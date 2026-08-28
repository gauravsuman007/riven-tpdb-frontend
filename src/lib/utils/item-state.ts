/**
 * One place to decide how a Riven item state is shown.
 *
 * Library cards, the TPDB detail page and the dashboard all need to answer the
 * same question -- is this available, on its way, or stuck -- and had they each
 * mapped states themselves they would have drifted apart. `variant` matches the
 * badge variants `list-item.svelte` already understands.
 */

export type StateVariant = "success" | "error" | "default";

export interface StateDisplay {
    /** Short label for a poster badge. */
    label: string;
    variant: StateVariant;
    /** Whether the file exists and can be played. */
    available: boolean;
    /** Whether Riven is still actively working on this item. */
    inProgress: boolean;
    /** Longer wording for the detail page, where there is room to explain. */
    description: string;
    /**
     * Tailwind background class for the colored bar along a poster's bottom
     * edge -- the same "state at a glance" idea a Whisparr-style poster strip
     * uses. A distinct color per state, not just per `variant`: `variant`
     * only has three buckets (success/error/default), which would make
     * "Requested" and "Fetching" indistinguishable even though they are very
     * different points in the pipeline.
     */
    barColor: string;
}

const UNKNOWN: StateDisplay = {
    label: "Unknown",
    variant: "default",
    available: false,
    inProgress: false,
    description: "Riven has no state recorded for this title.",
    barColor: "bg-zinc-600"
};

const STATES: Record<string, StateDisplay> = {
    Completed: {
        label: "Available",
        variant: "success",
        available: true,
        inProgress: false,
        description: "Downloaded and ready to play.",
        barColor: "bg-green-500"
    },
    Symlinked: {
        label: "Finishing",
        variant: "success",
        available: true,
        inProgress: true,
        description: "The file is in place; Riven is finishing up.",
        barColor: "bg-emerald-400"
    },
    Downloaded: {
        label: "Downloaded",
        variant: "success",
        available: false,
        inProgress: true,
        description: "The provider has the file; Riven is adding it to the library.",
        barColor: "bg-teal-400"
    },
    Scraped: {
        // Not "Searching": the search is over by this point -- releases were
        // found and one is being fetched. Calling it searching contradicted
        // the candidate list on the detail page, which was showing a release
        // as selected while the item claimed to still be looking.
        label: "Fetching",
        variant: "default",
        available: false,
        inProgress: true,
        description:
            "A release has been found and handed to your debrid provider. Uncached releases are fetched from the swarm first, which can take hours.",
        barColor: "bg-blue-500"
    },
    Indexed: {
        label: "Queued",
        variant: "default",
        available: false,
        inProgress: true,
        description: "Metadata is in; waiting to be scraped for releases.",
        barColor: "bg-sky-500"
    },
    Requested: {
        label: "Requested",
        variant: "default",
        available: false,
        inProgress: true,
        description: "Queued and waiting to be indexed.",
        barColor: "bg-amber-500"
    },
    PartiallyCompleted: {
        label: "Partial",
        variant: "default",
        available: true,
        inProgress: true,
        description: "Some parts of this title are available; the rest is still being worked on.",
        barColor: "bg-lime-500"
    },
    Ongoing: {
        label: "Ongoing",
        variant: "default",
        available: true,
        inProgress: true,
        description: "Still releasing; new parts are picked up as they appear.",
        barColor: "bg-cyan-500"
    },
    Paused: {
        label: "Paused",
        variant: "default",
        available: false,
        inProgress: false,
        description: "Paused. Riven will not work on this until it is resumed.",
        barColor: "bg-zinc-400"
    },
    Unreleased: {
        label: "Unreleased",
        variant: "default",
        available: false,
        inProgress: false,
        description: "Not released yet.",
        barColor: "bg-zinc-600"
    },
    Failed: {
        label: "Failed",
        variant: "error",
        available: false,
        inProgress: false,
        description: "Riven could not obtain this title.",
        barColor: "bg-red-500"
    }
};

export function describeState(state: string | null | undefined): StateDisplay {
    if (!state) return UNKNOWN;
    return STATES[state] ?? { ...UNKNOWN, label: state, description: `State: ${state}` };
}

/** Badge payload for `list-item.svelte`, or null when there is no state to show. */
export function stateBadge(state: string | null | undefined) {
    if (!state) return null;
    const display = describeState(state);
    return { text: display.label, variant: display.variant };
}
