import type { LayoutServerLoad } from "./$types";
import { getPermissionFlags } from "$lib/permissions";

export const load = (async ({ locals }) => {
    return {
        user: locals.user,
        permissions: getPermissionFlags(locals.user?.role)
    };
}) satisfies LayoutServerLoad;
