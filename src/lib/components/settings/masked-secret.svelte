<script lang="ts">
    /**
     * Text widget for credential fields (API keys, tokens, passwords).
     *
     * Blurred, it shows only the first and last few characters so a key can be
     * recognised without being readable over someone's shoulder. Focused, it
     * shows the real value so it stays editable and pasteable.
     *
     * The mask is display-only: `value` is always bound to the true string, so
     * the submitted form value is unaffected.
     */
    import { Datalist, getFormContext, inputAttributes, type ComponentProps } from "@sjsf/form";
    import { getThemeContext } from "@sjsf/shadcn4-theme";

    const VISIBLE = 4;

    const ctx = getFormContext();
    const themeCtx = getThemeContext();

    const { Input } = $derived(themeCtx.components);

    let { value = $bindable(), config, handlers }: ComponentProps["textWidget"] = $props();

    const attributes = $derived(inputAttributes(ctx, config, "shadcn4Text", handlers, {}));

    let focused = $state(false);
    let ref = $state<HTMLInputElement | null>(null);

    const raw = $derived(typeof value === "string" ? value : "");

    // Too short to reveal any of it without giving away most of the secret.
    const masked = $derived(
        raw.length === 0
            ? ""
            : raw.length <= VISIBLE * 2
              ? "•".repeat(raw.length)
              : `${raw.slice(0, VISIBLE)}${"•".repeat(Math.min(raw.length - VISIBLE * 2, 12))}${raw.slice(-VISIBLE)}`
    );

    function reveal() {
        focused = true;
        // The masked input is a different element, so move the caret to the
        // real one once it has replaced it.
        queueMicrotask(() => ref?.focus());
    }
</script>

{#if focused}
    <Input bind:value bind:ref {...attributes} onblur={() => (focused = false)} />
{:else}
    <Input
        value={masked}
        readonly
        placeholder={attributes.placeholder}
        id={attributes.id}
        onfocus={reveal}
        onclick={reveal} />
{/if}
<Datalist id={attributes.list} {config} />
