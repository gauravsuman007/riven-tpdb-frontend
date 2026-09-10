import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/*
    The AVN page moved into Explore. Kept as a redirect rather than deleted:
    bookmarks, the Jellyfin shell's saved links and anything the multiplexer
    injected still point here, and a 404 would read as the feature having been
    removed.
*/
export const load: PageServerLoad = () => redirect(308, "/explore/awards");
