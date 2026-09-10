<script lang="ts">
    /**
     * Signing in without typing a password, from a device that already is.
     *
     * The number is the security property. A bare "allow?" prompt on the
     * other device arrives with no evidence of who caused it, so the safe
     * answer and the convenient answer look the same; choosing which of
     * three numbers requires seeing this screen.
     */
    import { enhance } from "$app/forms";
    import { Button } from "$lib/components/ui/button";
    import * as Card from "$lib/components/ui/card";
    import { onDestroy } from "svelte";

    let { form } = $props();

    let polling = $state(false);
    let timer: ReturnType<typeof setInterval> | null = null;

    /* Start polling as soon as a number is on screen, and stop on any answer. */
    $effect(() => {
        if (form?.answer && !timer) {
            polling = true;
            timer = setInterval(() => document.getElementById("check")?.click(), 3000);
        }

        if (form?.error && timer) {
            clearInterval(timer);
            timer = null;
            polling = false;
        }
    });

    onDestroy(() => timer && clearInterval(timer));
</script>

<div class="mx-auto flex min-h-screen max-w-md items-center px-4">
    <Card.Root class="w-full">
        <Card.Header>
            <Card.Title class="text-2xl">Easy sign in</Card.Title>
            <Card.Description>
                Approve from a device that is already signed in, instead of typing a password.
            </Card.Description>
        </Card.Header>

        <Card.Content>
            {#if form?.error}
                <p class="mb-4 text-sm text-destructive">{form.error}</p>
            {/if}

            {#if form?.answer}
                <p class="text-sm text-muted-foreground">
                    On the other device, open Riven and choose this number:
                </p>
                <p class="my-6 text-center font-mono text-7xl font-bold">{form.answer}</p>
                <p class="text-sm text-muted-foreground">
                    {polling ? "Waiting…" : "Checking…"} This page checks by itself. The request expires
                    in a few minutes.
                </p>

                <form method="POST" action="?/check" use:enhance>
                    <button id="check" type="submit" class="sr-only">Check</button>
                </form>
            {:else}
                <form method="POST" action="?/start" use:enhance>
                    <Button type="submit" class="w-full">Start easy sign in</Button>
                </form>
            {/if}

            <p class="mt-6 text-center text-sm">
                <a class="underline" href="/auth/login">Type a password instead</a>
            </p>
        </Card.Content>
    </Card.Root>
</div>
