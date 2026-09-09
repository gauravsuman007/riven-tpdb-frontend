<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import { onDestroy } from "svelte";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import HardDrive from "@lucide/svelte/icons/hard-drive";
    import HardDriveDownload from "@lucide/svelte/icons/hard-drive-download";
    import CircleCheck from "@lucide/svelte/icons/circle-check";
    import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import { createScopedLogger } from "$lib/logger";

    const logger = createScopedLogger("keep-on-disk");

    interface Props {
        /** Riven's own numeric item id. Nothing renders without one. */
        id: string | number | null | undefined;
        title?: string | null;
        variant?:
            | "ghost"
            | "default"
            | "link"
            | "destructive"
            | "outline"
            | "secondary"
            | undefined;
        size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | undefined;
        class?: string;
    }

    let { id, title = null, variant = "outline", size = "sm", ...restProps }: Props = $props();

    type KeepState = "Queued" | "Syncing" | "OnDisk" | "Failed" | null;

    let available = $state(false);
    let copyState = $state<KeepState>(null);
    let percent = $state(0);
    let error = $state<string | null>(null);
    let busy = $state(false);
    let confirmOpen = $state(false);
    let loaded = $state(false);

    // Only while something is actually moving. A finished copy or an
    // unconfigured server would otherwise poll forever for no reason.
    const inFlight = $derived(copyState === "Queued" || copyState === "Syncing");

    let timer: ReturnType<typeof setInterval> | null = null;

    function stopPolling() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }

    onDestroy(stopPolling);

    async function refresh() {
        if (id === null || id === undefined) return;

        const response = await providers.riven.GET("/api/v1/keep/{id}", {
            params: { path: { id: Number(id) } }
        });

        if (!response.data) {
            logger.error("Keep status failed:", response.error);
            return;
        }

        available = response.data.enabled;
        copyState = (response.data.state ?? null) as KeepState;
        percent = response.data.percent ?? 0;
        error = response.data.error ?? null;
        loaded = true;
    }

    async function keep() {
        busy = true;

        const response = await providers.riven.POST("/api/v1/keep/{id}", {
            params: { path: { id: Number(id) } }
        });

        busy = false;

        if (!response.data) {
            // The backend answers 409 with a real reason -- no download yet,
            // path not writable -- which is more useful than "failed".
            const detail = (response.error as { detail?: string } | undefined)?.detail;
            toast.error(detail ?? "Could not keep this title on disk.");
            return;
        }

        copyState = (response.data.state ?? null) as KeepState;
        percent = response.data.percent ?? 0;
        error = null;
        toast.success("Queued to sync to disk.");
    }

    async function forget() {
        busy = true;

        const response = await providers.riven.DELETE("/api/v1/keep/{id}", {
            params: { path: { id: Number(id) }, query: { delete_file: true } }
        });

        busy = false;
        confirmOpen = false;

        if (!response.data) {
            toast.error("Could not remove the local copy.");
            return;
        }

        copyState = null;
        percent = 0;
        error = null;
        toast.success("Removed from local disk.");
    }

    $effect(() => {
        if (id === null || id === undefined) return;

        void refresh();
    });

    $effect(() => {
        stopPolling();

        if (!inFlight) return;

        timer = setInterval(refresh, 3000);

        return stopPolling;
    });
</script>

{#if available && loaded && id !== null && id !== undefined}
    {#if copyState === "OnDisk"}
        <AlertDialog.Root bind:open={confirmOpen}>
            <AlertDialog.Trigger>
                {#snippet child({ props })}
                    <Button
                        {variant}
                        {size}
                        title="Kept on this server. Click to remove the local copy."
                        {...restProps}
                        {...props}>
                        <CircleCheck class="mr-1 inline-block size-4 text-emerald-400" />
                        On disk
                    </Button>
                {/snippet}
            </AlertDialog.Trigger>
            <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
                <AlertDialog.Header>
                    <AlertDialog.Title>
                        Remove "{title ?? "this title"}" from local disk
                    </AlertDialog.Title>
                    <AlertDialog.Description>
                        The file is deleted from this server. The title stays in your library and
                        keeps streaming from the debrid provider.
                    </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                    <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                    <AlertDialog.Action disabled={busy} onclick={forget}>
                        {#if busy}
                            <Loader2 class="mr-1 inline-block animate-spin" />
                        {/if}
                        Remove
                    </AlertDialog.Action>
                </AlertDialog.Footer>
            </AlertDialog.Content>
        </AlertDialog.Root>
    {:else if inFlight}
        <Button
            {variant}
            {size}
            class="relative overflow-hidden {restProps.class ?? ''}"
            title="Copying to this server. Click to stop and discard."
            onclick={forget}
            disabled={busy}>
            <!-- Progress as a fill behind the label, so the button stays one
                 control rather than becoming a button plus a progress bar. -->
            <span
                class="absolute inset-y-0 left-0 bg-primary/20 transition-[width] duration-500"
                style="width: {percent}%"
                aria-hidden="true"></span>
            <span class="relative inline-flex items-center">
                <Loader2 class="mr-1 inline-block size-4 animate-spin" />
                {copyState === "Queued" ? "Queued" : `Syncing ${percent.toFixed(0)}%`}
            </span>
        </Button>
    {:else if copyState === "Failed"}
        <Button
            {variant}
            {size}
            title={error ?? "The last copy failed"}
            onclick={keep}
            disabled={busy}
            {...restProps}>
            <TriangleAlert class="mr-1 inline-block size-4 text-amber-400" />
            Retry sync
        </Button>
    {:else}
        <Button {variant} {size} onclick={keep} disabled={busy} {...restProps}>
            {#if busy}
                <Loader2 class="mr-1 inline-block size-4 animate-spin" />
            {:else if copyState === null}
                <HardDriveDownload class="mr-1 inline-block size-4" />
            {:else}
                <HardDrive class="mr-1 inline-block size-4" />
            {/if}
            Keep on disk
        </Button>
    {/if}
{/if}
