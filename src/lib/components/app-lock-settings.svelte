<script lang="ts">
    /**
     * The app PIN, on the General settings tab.
     *
     * Not part of the schema-driven form above it, and deliberately so: that
     * form is generated from the BACKEND's settings schema, and this is a
     * per-user frontend fact stored in the frontend's own database. Putting it
     * in the backend settings would both misplace it and write the PIN into a
     * file the backend shares with everything else.
     */
    import { invalidateAll } from "$app/navigation";
    import { Button } from "$lib/components/ui/button";
    import { toast } from "svelte-sonner";
    import { LockKeyhole } from "@lucide/svelte";

    let enabled = $state(false);
    let hasPin = $state(false);
    let timeoutMinutes = $state(10);
    let pin = $state("");
    let confirmPin = $state("");
    let busy = $state(false);
    let loaded = $state(false);

    async function refresh() {
        try {
            const response = await fetch("/api/lock/settings");
            if (!response.ok) return;

            const state = await response.json();
            enabled = state.enabled;
            hasPin = state.hasPin;
            timeoutMinutes = state.timeoutMinutes ?? 10;
        } finally {
            loaded = true;
        }
    }

    $effect(() => {
        if (!loaded) void refresh();
    });

    async function save() {
        if (!/^\d{4}$/.test(pin)) {
            toast.error("The PIN must be exactly four digits");
            return;
        }

        if (pin !== confirmPin) {
            toast.error("The two PINs do not match");
            return;
        }

        busy = true;

        try {
            const response = await fetch("/api/lock/settings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ pin, timeoutMinutes })
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                toast.error(payload?.message ?? "Could not save the PIN");
                return;
            }

            pin = "";
            confirmPin = "";
            await refresh();
            // The layout hands the guard its settings, so it has to reload for
            // a newly-set timeout to take effect without a refresh.
            await invalidateAll();
            toast.success("App PIN set");
        } finally {
            busy = false;
        }
    }

    async function disable() {
        busy = true;

        try {
            const response = await fetch("/api/lock/settings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "disable" })
            });

            if (!response.ok) {
                toast.error("Could not remove the PIN");
                return;
            }

            await refresh();
            await invalidateAll();
            toast.success("App PIN removed");
        } finally {
            busy = false;
        }
    }

    async function lockNow() {
        await fetch("/api/lock/settings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action: "lock" })
        });

        location.href = "/lock";
    }
</script>

<div class="border-border/60 bg-muted/30 flex flex-col gap-4 rounded-lg border p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
            <p class="flex items-center gap-2 text-sm font-medium">
                <LockKeyhole class="size-4" />
                App PIN
            </p>
            <p class="text-muted-foreground text-xs">
                Blanks the app after a period with no activity and no playback, and asks for a
                4-digit code. The sign-in page is never locked.
            </p>
        </div>

        {#if hasPin}
            <div class="flex gap-2">
                <Button size="sm" variant="outline" onclick={lockNow} disabled={busy}>
                    Lock now
                </Button>
                <Button size="sm" variant="destructive" onclick={disable} disabled={busy}>
                    Remove
                </Button>
            </div>
        {/if}
    </div>

    {#if hasPin}
        <p class="text-muted-foreground text-xs">
            A PIN is set and the app locks after {timeoutMinutes} minutes idle. Entering a new one below
            replaces it.
        </p>
    {/if}

    <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
            <span class="text-muted-foreground text-xs">{hasPin ? "New PIN" : "PIN"}</span>
            <input
                bind:value={pin}
                type="password"
                inputmode="numeric"
                maxlength="4"
                autocomplete="new-password"
                placeholder="••••"
                class="border-border bg-background w-24 rounded-md border px-3 py-2 text-center tracking-[0.4em] outline-none focus:ring-2 focus:ring-primary/40" />
        </label>

        <label class="flex flex-col gap-1">
            <span class="text-muted-foreground text-xs">Confirm</span>
            <input
                bind:value={confirmPin}
                type="password"
                inputmode="numeric"
                maxlength="4"
                autocomplete="new-password"
                placeholder="••••"
                class="border-border bg-background w-24 rounded-md border px-3 py-2 text-center tracking-[0.4em] outline-none focus:ring-2 focus:ring-primary/40" />
        </label>

        <label class="flex flex-col gap-1">
            <span class="text-muted-foreground text-xs">Lock after (minutes)</span>
            <input
                bind:value={timeoutMinutes}
                type="number"
                min="1"
                max="240"
                class="border-border bg-background w-28 rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" />
        </label>

        <Button size="sm" onclick={save} disabled={busy || pin.length !== 4}>
            {hasPin ? "Replace PIN" : "Set PIN"}
        </Button>
    </div>

    <p class="text-muted-foreground text-[11px] leading-relaxed">
        This is a screen lock, not a second password. It stops someone picking up an already
        signed-in device from reading what is on screen; it is not a barrier to anyone who can
        open the browser's developer tools.
    </p>
</div>
