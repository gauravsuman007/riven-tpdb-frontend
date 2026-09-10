/*
    One rail, re-ranked.

    The per-rail rating controls call this rather than filtering what the page
    already holds. That distinction is the whole point: a rail carries twenty
    titles, and narrowing those twenty to the four with four stars is a
    different -- and much worse -- answer than asking the catalogue for its
    best four-star titles under that intent. The filter belongs where the
    corpus is.

    It exists as an endpoint rather than a form action because the controls are
    a live adjustment: a form action re-runs the page load, which would re-rank
    every other rail on the page to change one of them.
*/

import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { getRail } from "$lib/recommendations";

export const GET: RequestHandler = async (event) => {
    if (!event.locals.user || !event.locals.session) {
        error(401, "Not signed in");
    }

    const params = event.url.searchParams;
    const engine = params.get("engine") === "scenes" ? "scenes" : "movies";
    const intent = params.get("intent");
    const sort = params.get("sort") === "rating" ? "rating" : "score";
    const minRating = Number(params.get("min_rating") ?? 0);

    // The scene engine has nothing to query without an intent -- there is no
    // "everything on StashDB" ranking -- and the backend answers 400. Caught
    // here so the rail shows its own error rather than a raw failure.
    if (engine === "scenes" && !intent) {
        error(400, "A scene rail needs an intent");
    }

    const items = await getRail(
        {
            baseUrl: event.locals.backendUrl,
            apiKey: event.locals.apiKey,
            fetch: event.fetch
        },
        {
            intent,
            engine,
            sort,
            minRating: Number.isFinite(minRating) ? minRating : 0,
            limit: Number(params.get("limit") ?? 20)
        }
    );

    if (items === null) {
        error(502, "The recommendation engine did not answer");
    }

    return json({ items });
};
