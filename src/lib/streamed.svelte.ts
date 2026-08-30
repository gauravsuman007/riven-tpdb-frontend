/**
 * A promise from a streamed `load`, as reactive state.
 *
 * SvelteKit renders a page as soon as its load returns, and any promise it
 * returned UNAWAITED resolves afterwards over the same response. That is what
 * turns a page that waits for its slowest query into one that paints
 * immediately -- but the idiomatic consumer, `{#await}`, forces every section
 * that touches the data into a three-branch block, which for a dashboard of
 * a dozen cards means restructuring the whole template.
 *
 * This does the same job without that: the value starts undefined and becomes
 * the resolved data, so markup written against optional data keeps working and
 * only gains a skeleton where `loading` is true.
 *
 * Deliberately tolerant of a plain value as well as a promise. A load that
 * cannot stream a particular field (it needs it to decide a redirect, say)
 * can hand back the value itself and the call site does not change.
 */
export interface Streamed<T> {
    /** The resolved data, or undefined until it arrives. */
    readonly value: T | undefined;
    /** Whatever the promise rejected with, if it did. */
    readonly error: unknown;
    /** True whenever a fetch is in flight, including a refresh. */
    readonly loading: boolean;
    /** True only before the first resolution -- when there is nothing to show yet. */
    readonly pending: boolean;
}

/*
    The return type is written out rather than inferred, and it has to be.
    These getters read `$state` variables whose own type comes from `T`, which
    TypeScript resolves through the return type -- so leaving it off makes every
    call site circular ("'stats' implicitly has type 'any' because it is
    referenced ... in its own initializer") and silently degrades the whole page
    to `any`.
*/
export function streamed<T>(source: () => T | Promise<T> | undefined): Streamed<T> {
    let value = $state<T | undefined>(undefined);
    let error = $state<unknown>(undefined);
    let loading = $state(true);

    $effect(() => {
        const current = source();

        /*
            Guards a navigation landing mid-flight.

            Without it, page A's slow query resolving after page B has loaded
            writes A's data into B's view -- the classic streamed-load race,
            and one that shows up as stale numbers rather than an error.
        */
        let live = true;

        if (!(current instanceof Promise)) {
            value = current;
            error = undefined;
            loading = false;

            return;
        }

        // Not reset to undefined here: re-fetching an already-loaded section
        // should keep showing the old numbers while the new ones arrive,
        // rather than flashing a skeleton over data that is merely stale.
        loading = true;

        current
            .then((resolved) => {
                if (!live) return;

                value = resolved;
                error = undefined;
            })
            .catch((reason) => {
                if (!live) return;

                error = reason;
            })
            .finally(() => {
                if (live) loading = false;
            });

        return () => {
            live = false;
        };
    });

    return {
        get value() {
            return value;
        },
        get error() {
            return error;
        },
        get loading() {
            return loading;
        },
        /** True only before the first resolution -- when there is nothing to show yet. */
        get pending() {
            return loading && value === undefined;
        }
    };
}
