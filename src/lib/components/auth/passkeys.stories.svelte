<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import Passkeys from "./passkeys.svelte";

    const { Story } = defineMeta({
        title: "auth/Passkeys",
        component: Passkeys,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "Self-fetching via `authClient.passkey.listUserPasskeys()` on mount — there's no backend in Storybook, so the request fails and the component falls back to its real empty state (the failure is caught, not surfaced)."
                }
            }
        }
    });
</script>

<Story name="Default" />
