/**
 * Where to find each studio's cached logo, and whether it is dark.
 *
 * For riven-tv, whose pages run no script and so cannot measure an image or
 * wait for one: it needs, in the markup it sends, the address of a logo and
 * whether to put a light plate behind it. The cache itself is
 * `$lib/server/studio-logos` -- the same one the Studios page uses -- so the
 * television and the browser share one copy on the data volume, and one
 * definition of "dark".
 *
 * Only studios with a usable logo appear in the answer; absence means "draw
 * the name", never an error.
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getStudio } from "$lib/studios";
import { logoVersion, studioLogo } from "$lib/server/studio-logos";

const MOST = 24;

export const GET: RequestHandler = async ({ url, locals, fetch }) => {
    if (!locals.user) error(401, "Not signed in");

    const ids = [
        ...new Set(
            (url.searchParams.get("ids") ?? "")
                .split(",")
                .map(Number)
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    ].slice(0, MOST);

    const options = { baseUrl: locals.backendUrl, apiKey: locals.apiKey, fetch };
    const found = await Promise.all(
        ids.map(async (id) => {
            const studio = await getStudio(id, options);
            const logo = await studioLogo(id, studio?.logo_path ?? null, fetch);

            return logo && studio?.logo_path
                ? ([
                      id,
                      {
                          src: `/studios/${id}/logo?v=${logoVersion(studio.logo_path)}`,
                          dark: logo.dark
                      }
                  ] as const)
                : null;
        })
    );

    return json({ logos: Object.fromEntries(found.filter((entry) => entry !== null)) });
};
