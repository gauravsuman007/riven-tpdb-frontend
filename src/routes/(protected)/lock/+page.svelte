<script lang="ts">
    /**
     * The lock screen.
     *
     * A real route, not an overlay, because the server redirects here before
     * any page data loads -- so there is genuinely nothing behind this to
     * leak. An overlay would still have the content in the DOM.
     */
    import { goto, invalidateAll } from "$app/navigation";
    import { LockKeyhole } from "@lucide/svelte";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    let digits = $state(["", "", "", ""]);
    let error = $state<string | null>(null);
    let busy = $state(false);
    let inputs: HTMLInputElement[] = [];

    const pin = $derived(digits.join(""));

    function focusFirstEmpty() {
        const idx = digits.findIndex((d) => d === "");
        inputs[idx === -1 ? 3 : idx]?.focus();
    }

    $effect(() => {
        focusFirstEmpty();
    });

    async function submit() {
        if (pin.length !== 4 || busy) return;

        busy = true;
        error = null;

        try {
            const response = await fetch("/api/lock/unlock", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pin })
            });

            if (response.ok) {
                // invalidateAll first: the redirect target's data was never
                // loaded while locked, so it has to be fetched fresh.
                await invalidateAll();
                await goto(data.next, { replaceState: true });
                return;
            }

            const payload = await response.json().catch(() => ({}));
            error = payload?.message ?? "Incorrect PIN";
            digits = ["", "", "", ""];
            focusFirstEmpty();
        } catch {
            error = "Could not reach the server";
        } finally {
            busy = false;
        }
    }

    function onInput(index: number, event: Event) {
        const target = event.target as HTMLInputElement;
        // Only the last character, so retyping over a filled box replaces it
        // rather than being ignored.
        const value = target.value.replace(/\D/g, "").slice(-1);

        digits[index] = value;
        target.value = value;

        if (value && index < 3) inputs[index + 1]?.focus();
        if (digits.every((d) => d !== "")) submit();
    }

    function onKeydown(index: number, event: KeyboardEvent) {
        if (event.key === "Backspace" && !digits[index] && index > 0) {
            digits[index - 1] = "";
            inputs[index - 1]?.focus();
            event.preventDefault();
        }

        if (event.key === "Enter") submit();
    }

    function onPaste(event: ClipboardEvent) {
        const text = (event.clipboardData?.getData("text") ?? "").replace(/\D/g, "").slice(0, 4);

        if (!text) return;

        event.preventDefault();
        digits = [0, 1, 2, 3].map((i) => text[i] ?? "");
        inputs.forEach((input, i) => (input.value = digits[i] ?? ""));

        if (text.length === 4) submit();
        else focusFirstEmpty();
    }
</script>

<svelte:head>
    <title>Locked</title>
</svelte:head>

<div class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-6">
    <div class="flex flex-col items-center gap-3 text-center">
        <div class="rounded-full border border-border bg-muted/40 p-4">
            <LockKeyhole class="size-7 text-muted-foreground" />
        </div>
        <h1 class="text-xl font-semibold">Locked</h1>
        <p class="max-w-xs text-sm text-muted-foreground">
            {#if data.hasPin}
                Enter your 4-digit code to continue.
            {:else}
                No PIN is set. Sign out and back in to continue.
            {/if}
        </p>
    </div>

    {#if data.hasPin}
        <div class="flex gap-3" onpaste={onPaste}>
            {#each digits as _digit, index (index)}
                <input
                    bind:this={inputs[index]}
                    type="password"
                    inputmode="numeric"
                    autocomplete="off"
                    maxlength="1"
                    aria-label={`Digit ${index + 1}`}
                    disabled={busy}
                    class="size-14 rounded-xl border border-border bg-muted/30 text-center text-2xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    oninput={(event) => onInput(index, event)}
                    onkeydown={(event) => onKeydown(index, event)}
                />
            {/each}
        </div>

        <p class="h-5 text-sm text-destructive" role="alert" aria-live="polite">{error ?? ""}</p>
    {/if}

    <a href="/auth/logout" class="text-xs text-muted-foreground underline underline-offset-4">
        Sign out instead
    </a>
</div>
