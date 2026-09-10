import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/* Moved into Explore. See the note in ../avn/+page.server.ts. */
export const load: PageServerLoad = () => redirect(308, "/explore/brochure");
