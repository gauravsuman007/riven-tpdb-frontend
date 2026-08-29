import { error } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import providers from "$lib/providers";
import { logger } from "$lib/logger";

/**
 * Detail page for a library item that has no external record to render from.
 *
 * Every other detail page is built around a provider's data -- TMDB's model,
 * or a TPDB record. An adult title that TPDB has no confident match for has
 * neither, and until this existed the library grid simply DROPPED such items
 * (`transformItems` returned null for anything with no external id), so a
 * title with perfectly good local metadata became unreachable.
 *
 * That also made a wrong TPDB association impossible to withdraw: detaching
 * it would have hidden the title. This page is what makes clearing one a
 * usable action rather than a way to lose things.
 */
export const load: PageServerLoad = async ({ params, fetch, locals }) => {
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) error(400, "Invalid item id");

    const auth = {
        baseUrl: locals.backendUrl,
        headers: { "x-api-key": locals.apiKey },
        fetch
    };

    const response = await providers.riven.GET("/api/v1/items/{id}", {
        ...auth,
        params: { path: { id: String(id) }, query: { media_type: "item", extended: true } }
    });

    if (response.error || !response.data) {
        logger.error(`riven detail load failed for ${id}`, response.error);
        error(404, "Item not found");
    }

    // Rendered straight from the item. The TPDB page reaches for
    // `library_states` because it starts from a TPDB uuid and has to find the
    // library row behind it; here the library row IS the source, and it
    // already carries state and filesystem_entry.
    return { item: response.data as Record<string, unknown> };
};

export const actions = {
    /** Attach a TPDB record the user picked by hand, or detach the current one. */
    setTpdb: async ({ request, params, locals, fetch }) => {
        const data = await request.formData();
        const raw = String(data.get("tpdbId") ?? "").trim();

        const response = await providers.riven.POST("/api/v1/items/{item_id}/tpdb", {
            baseUrl: locals.backendUrl,
            headers: { "x-api-key": locals.apiKey },
            fetch,
            params: { path: { item_id: Number(params.id) } },
            body: { tpdb_id: raw || null }
        });

        if (response.error) {
            logger.error(`setting tpdb for ${params.id} failed`, response.error);
            return { success: false };
        }

        return { success: true, tpdbId: raw || null };
    }
} satisfies Actions;
