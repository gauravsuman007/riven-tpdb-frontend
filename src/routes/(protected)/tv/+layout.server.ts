import type { LayoutServerLoad } from "./$types";

/*
    No client-side rendering anywhere under /tv.

    This is the whole reason the section exists. The app's normal pages boot
    by calling dynamic `import()`, which needs Chromium 63; an LG C9 is a 2019
    set, so webOS 4.5, so Chromium 53. There the bootstrap throws, nothing
    hydrates, and the page is whatever the server rendered -- unstyled,
    because the stylesheet is Tailwind v4 output that the same engine cannot
    parse either (`@layer` wants 99).

    `csr = false` removes that bootstrap entirely, so these pages are plain
    server-rendered HTML that any browser back to about 2016 can display.
    Everything here must therefore work with NO JavaScript at all: links and
    form GETs only.
*/
export const csr = false;

export const load = (async ({ locals }) => {
    return { user: locals.user };
}) satisfies LayoutServerLoad;
