<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import OauthProviderButton from "./oauth-provider-button.svelte";
    import { fn } from "storybook/test";

    const { Story } = defineMeta({
        title: "auth/OauthProviderButton",
        component: OauthProviderButton,
        tags: ["autodocs"],
        args: {
            isLastUsed: false,
            onclick: fn()
        }
    });
</script>

<Story name="Plex" args={{ providerKey: "plex", provider: { name: "Plex" } }} />

<Story name="GenericOAuth" args={{ providerKey: "authentik", provider: { name: "Authentik" } }} />

<Story
    name="LastUsed"
    args={{ providerKey: "plex", provider: { name: "Plex" }, isLastUsed: true }} />

<Story
    name="WithIcon"
    args={{
        providerKey: "google",
        provider: {
            name: "Google",
            icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/google.svg"
        }
    }} />
