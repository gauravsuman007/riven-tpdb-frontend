/*
    The dashboard's data, described once.

    The dashboard is no longer a page of its own -- it is a tab on the
    settings page (see `settings/+page.server.ts`), and its markup lives in
    `$lib/components/settings/dashboard-panel.svelte`. A component under
    `$lib` cannot import a route's generated `./$types`, so the shape the
    loader returns and the panel consumes is stated here instead, where both
    sides can see it.

    The four fields are PROMISES on purpose; see `$lib/server/dashboard.ts`
    for why nothing is awaited.
*/

import type { operations } from "$lib/providers/riven";

type Ok<O extends keyof operations> = operations[O]["responses"] extends {
    200: { content: { "application/json": infer R } };
}
    ? R
    : never;

export interface DashboardData {
    statistics: Promise<Ok<"stats"> | undefined>;
    services: Promise<Ok<"services"> | undefined>;
    downloaderInfo: Promise<Ok<"download_user_info"> | undefined>;
    downloads: Promise<Ok<"get_download_activity"> | undefined>;
}
