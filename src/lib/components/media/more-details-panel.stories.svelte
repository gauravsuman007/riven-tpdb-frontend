<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import MoreDetailsPanel from "./more-details-panel.svelte";

    const { Story } = defineMeta({
        title: "media/MoreDetailsPanel",
        component: MoreDetailsPanel,
        tags: ["autodocs"],
        args: {
            budget: 90000000,
            revenue: 440000000,
            originCountry: ["US"],
            spokenLanguages: [{ english_name: "English" }],
            productionCompanies: [{ name: "Thunder Road" }, { name: "87Eleven" }],
            homepage: "https://www.johnwick.movie",
            imdbId: "tt10366206",
            externalLinks: [
                {
                    key: "facebook_id",
                    label: "Facebook",
                    url: "https://www.facebook.com/JohnWickMovie"
                }
            ]
        }
    });
</script>

<Story name="Movie" />

<Story name="TvShow" args={{ budget: undefined, revenue: undefined }} />

<Story
    name="Minimal"
    args={{
        budget: undefined,
        revenue: undefined,
        originCountry: undefined,
        spokenLanguages: undefined,
        productionCompanies: undefined,
        homepage: undefined,
        imdbId: undefined,
        externalLinks: []
    }} />
