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
}

const UNKNOWN: StateDisplay = {
    label: "Unknown",
    variant: "default",
    available: false,
    inProgress: false,
    description: "Riven has no state recorded for this title."
};

const STATES: Record<string, StateDisplay> = {
    Completed: {
        label: "Available",
        variant: "success",
        available: true,
        inProgress: false,
        description: "Downloaded and ready to play."
    },
    Symlinked: {
        label: "Finishing",
        variant: "success",
        available: true,
        inProgress: true,
        description: "The file is in place; Riven is finishing up."
    },
    Downloaded: {
        label: "Downloaded",
        variant: "success",
        available: false,
        inProgress: true,
        description: "The provider has the file; Riven is adding it to the library."
    },
    Scraped: {
        label: "Searching",
        variant: "default",
        available: false,
        inProgress: true,
        description:
            "Releases were found and are being offered to your debrid provider. Uncached ones are fetched in the background, which can take hours."
    },
    Indexed: {
        label: "Queued",
        variant: "default",
        available: false,
        inProgress: true,
        description: "Metadata is in; waiting to be scraped for releases."
    },
    Requested: {
        label: "Requested",
        variant: "default",
        available: false,
        inProgress: true,
        description: "Queued and waiting to be indexed."
    },
    PartiallyCompleted: {
        label: "Partial",
        variant: "default",
        available: true,
        inProgress: true,
        description: "Some parts of this title are available; the rest is still being worked on."
    },
    Ongoing: {
        label: "Ongoing",
        variant: "default",
        available: true,
        inProgress: true,
        description: "Still releasing; new parts are picked up as they appear."
    },
    Paused: {
        label: "Paused",
        variant: "default",
        available: false,
        inProgress: false,
        description: "Paused. Riven will not work on this until it is resumed."
    },
    Unreleased: {
        label: "Unreleased",
        variant: "default",
        available: false,
        inProgress: false,
        description: "Not released yet."
    },
    Failed: {
        label: "Failed",
        variant: "error",
        available: false,
        inProgress: false,
        description: "Riven could not obtain this title."
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
