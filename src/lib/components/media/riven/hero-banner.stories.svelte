<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import HeroBanner from "./hero-banner.svelte";

    const { Story } = defineMeta({
        title: "media/riven/HeroBanner",
        component: HeroBanner,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "Owns its own trailer-toggle state and renders nothing when neither `backdropPath` nor `trailer` is provided."
                }
            }
        },
        args: {
            backdropPath: "https://image.tmdb.org/t/p/w1920/9E2y5Q7WlCVNEhP5GiVTjhEhx1o.jpg",
            logo: "https://image.tmdb.org/t/p/w500/8UlWHLMpgZm9bx6QYh0NFoq67TZ.png",
            trailer: null
        }
    });
</script>

<Story name="Default" />

<Story
    name="WithTrailer"
    args={{
        trailer: { name: "Official Trailer", site: "YouTube", key: "dQw4w9WgXcQ" }
    }} />

<Story name="NoLogo" args={{ logo: null }} />

<Story
    name="Empty"
    args={{ backdropPath: null, logo: null, trailer: null }}
    parameters={{
        docs: { description: { story: "Renders nothing when there is nothing to show." } }
    }} />
