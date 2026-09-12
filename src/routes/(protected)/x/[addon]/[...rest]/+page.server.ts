import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { listAddons } from "$lib/addons";

/*
    Resolved server-side so that a URL naming an add-on that is not installed
    (or is installed and broken) answers with a real 404 or a real explanation,
    rather than rendering an empty page that silently fails to import a bundle.
*/
export const load: PageServerLoad = async ({ params, fetch }) => {
    const result = await listAddons(fetch);

    if ("error" in result) return { addon: null };

    const addon = result.addons.addons.find((candidate) => candidate.key === params.addon);

    if (!addon) error(404, "No such add-on");

    return { addon };
};
