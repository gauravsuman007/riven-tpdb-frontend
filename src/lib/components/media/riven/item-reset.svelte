<script lang="ts">
    import { gqlClient } from "$lib/graphql-client";
    import { toast } from "svelte-sonner";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import { createScopedLogger } from "$lib/logger";

    const logger = createScopedLogger("item-reset");

    import { type Snippet } from "svelte";

    interface Props {
        title: string | null | undefined;
        ids: (string | null | undefined)[];
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
        onSuccess?: () => void | Promise<void>;
        children?: Snippet;
    }
    let {
        title,
        ids,
        variant = "ghost",
        size = "sm",
        onSuccess,
        children,
        ...restProps
    }: Props = $props();

    async function resetMediaItem(ids: (string | null | undefined)[]): Promise<boolean> {
        const validIds = ids
            .filter((id): id is string => id !== null && id !== undefined)
            .map(Number)
            .filter((n) => !isNaN(n));

        if (validIds.length === 0) {
            toast.error("No media item ID found to reset.");
            return false;
        }

        try {
            const result = await gqlClient<{ resetItems: number }>(
                `mutation ResetItems($ids: [Int!]!) { resetItems(ids: $ids) }`,
                { ids: validIds }
            );
            if (result.resetItems > 0) {
                toast.success("Media item reset successfully.");
                await onSuccess?.();
                return true;
            }

            toast.info("No matching media items were reset.");
            return false;
        } catch (e) {
            logger.error("Error resetting items:", e);
            toast.error("Failed to reset media item.");
            return false;
        }
    }

    let open = $state(false);
    let loading = $state(false);
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            <Button {variant} {size} {...restProps} {...props}>
                {#if children}
                    {@render children()}
                {:else}
                    Reset
                {/if}
            </Button>
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>
                Resetting "{title ?? "Media Item"}"
            </AlertDialog.Title>
            <AlertDialog.Description>
                This will send a request to Riven to reset this media. You will be notified when
                it's done.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button
                disabled={loading}
                onclick={async () => {
                    loading = true;
                    const success = await resetMediaItem(ids);
                    loading = false;
                    if (success) {
                        open = false;
                    }
                }}>
                {#if loading}
                    <Loader2 class="mr-1 inline-block animate-spin" />
                {/if}
                Reset
            </Button>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
