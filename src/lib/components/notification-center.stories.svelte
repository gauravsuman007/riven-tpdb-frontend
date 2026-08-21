<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import NotificationCenter from "./notification-center.svelte";

    const { Story } = defineMeta({
        title: "components/NotificationCenter",
        component: NotificationCenter,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "`notificationStore` is a module-level singleton connected to a live WebSocket (`connect()` on mount), not an injectable prop, so it can't be seeded with fixture data in isolation. With no backend available in Storybook the connection fails and the component falls back to its real empty-state + connection-error UI — both genuine, designed states."
                }
            }
        }
    });
</script>

<Story name="Default" />
