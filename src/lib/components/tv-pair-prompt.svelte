<script lang="ts">
    /**
     * "A television wants to sign in." The prompt, and the three numbers.
     *
     * WHY THE NUMBERS
     * ---------------
     * A bare allow/deny arrives with no evidence of who caused it, so the
     * safe answer and the convenient answer look identical and the reflex
     * is to allow. Anything that can reach the service could raise one and
     * wait. Choosing WHICH number needs line of sight to the television,
     * which is the one thing a remote attacker does not have. A wrong
     * choice refuses outright -- a one-in-three barrier is worth having
     * only if it cannot be retried.
     *
     * WHY IT STAYS AWAY DURING PLAYBACK
     * ---------------------------------
     * A modal over a film is the single most annoying thing an app can do,
     * and the request is not urgent: it waits three minutes and the person
     * who started it is standing in front of another screen. So the poll
     * keeps running and the prompt simply does not mount while something
     * is playing; it appears when the video is closed, if the request is
     * still alive.
     */
    import { player } from "$lib/stores/player.svelte";
    import { onMount } from "svelte";
    import { Button } from "$lib/components/ui/button";

    interface Pending {
        id: string;
        label: string;
        choices: number[];
        createdAt: number;
    }

    let pending = $state<Pending[]>([]);
    let answering = $state(false);
    let outcome = $state<{ ok: boolean; message: string } | null>(null);
    /* Dismissed by the viewer: do not raise the same one again. */
    let ignored = $state<string[]>([]);

    const request = $derived(pending.find((entry) => !ignored.includes(entry.id)));
    /* `player.current` is set for the whole time a video is open. */
    const showing = $derived(Boolean(request) && !player.current);

    async function poll() {
        try {
            const response = await fetch("/api/tv-pair", { headers: { accept: "application/json" } });

            if (!response.ok) return;

            pending = ((await response.json())?.pending ?? []) as Pending[];
        } catch {
            /* Offline, or riven-tv not deployed. Nothing to say about it. */
        }
    }

    async function choose(id: string, choice: number) {
        answering = true;

        try {
            const body = new FormData();
            body.set("id", id);
            body.set("choice", String(choice));

            const response = await fetch("/api/tv-pair", { method: "POST", body });
            outcome = await response.json();
        } catch {
            outcome = { ok: false, message: "Could not reach the TV service." };
        } finally {
            answering = false;
            ignored = [...ignored, id];
            poll();
        }
    }

    onMount(() => {
        poll();

        /*
            Eight seconds. The request lives three minutes, so this is
            responsive enough to feel immediate while a television is being
            set up, and quiet enough to be running on every page all day.
        */
        const timer = setInterval(poll, 8000);

        return () => clearInterval(timer);
    });
</script>

{#if showing && request}
    <div class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div
            class="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl"
            role="dialog"
            aria-label="A television is asking to sign in"
        >
            <p class="text-sm font-medium">{request.label} is asking to sign in.</p>
            <p class="mt-1 text-xs text-muted-foreground">
                Choose the number it is showing on screen. Choosing the wrong one refuses the
                request.
            </p>

            <div class="mt-4 flex gap-2">
                {#each request.choices as choice (choice)}
                    <Button
                        variant="outline"
                        class="flex-1 font-mono text-xl"
                        disabled={answering}
                        onclick={() => choose(request.id, choice)}
                    >
                        {choice}
                    </Button>
                {/each}
            </div>

            <button
                class="mt-3 text-xs text-muted-foreground underline"
                onclick={() => (ignored = [...ignored, request.id])}
            >
                Not me &mdash; ignore this
            </button>
        </div>
    </div>
{/if}

{#if outcome}
    <div class="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div class="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl">
            <p class="text-sm" class:text-destructive={!outcome.ok}>{outcome.message}</p>
            <button class="mt-2 text-xs underline" onclick={() => (outcome = null)}>Close</button>
        </div>
    </div>
{/if}
