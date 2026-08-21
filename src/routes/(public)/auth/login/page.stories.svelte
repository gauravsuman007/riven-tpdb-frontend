<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import LoginPage from "./+page.svelte";

    const { Story } = defineMeta({
        title: "pages/Login",
        component: LoginPage,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<script lang="ts">
    import { defaults } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { loginSchema, registerSchema } from "$lib/schemas/auth";

    const loginForm = defaults(zod4(loginSchema));
    const registerForm = defaults(zod4(registerSchema));

    const credentialOnly = {
        loginForm,
        registerForm,
        authProviders: {
            credential: { enabled: true, disableSignup: false }
        },
        isFirstUser: false
    };

    const withOAuth = {
        loginForm,
        registerForm,
        authProviders: {
            credential: { enabled: true, disableSignup: false },
            plex: { enabled: true, disableSignup: false, name: "Plex" },
            authentik: { enabled: true, disableSignup: false, name: "Authentik" }
        },
        isFirstUser: false
    };

    const signupDisabled = {
        loginForm,
        registerForm: null,
        authProviders: {
            credential: { enabled: true, disableSignup: true },
            plex: { enabled: true, disableSignup: false, name: "Plex" }
        },
        isFirstUser: false
    };
</script>

<Story name="CredentialOnly" args={{ data: credentialOnly }} />

<Story name="WithOAuthProviders" args={{ data: withOAuth }} />

<Story name="SignupDisabled" args={{ data: signupDisabled }} />
