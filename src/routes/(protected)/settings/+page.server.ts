import type { Actions, PageServerLoad } from "./$types";
import { error, fail } from "@sveltejs/kit";
import providers from "$lib/providers";
import type { InitialFormData } from "@sjsf/sveltekit";
import { createFormHandler } from "@sjsf/sveltekit/server";
import * as defaults from "$lib/components/settings/form-defaults";

const getSchema = async (baseUrl: string, apiKey: string, fetch: typeof globalThis.fetch) => {
    const settingsSchema = await providers.riven.GET("/api/v1/settings/schema", {
        baseUrl,
        headers: {
            "x-api-key": apiKey
        },
        fetch
    });
    if (settingsSchema.error) {
        throw new Error("Failed to load settings schema");
    }

    return settingsSchema.data;
};

export const load: PageServerLoad = async ({ fetch, locals }) => {
    const allSettings = await providers.riven.GET("/api/v1/settings/get/all", {
        baseUrl: locals.backendUrl,
        headers: {
            "x-api-key": locals.apiKey
        },
        fetch: fetch
    });

    if (allSettings.error) {
        error(500, "Failed to load settings");
    }

    return {
        form: {
            schema: await getSchema(locals.backendUrl, locals.apiKey, fetch),
            initialValue: allSettings.data
        } satisfies InitialFormData
    };
};

/**
 * A form-shaped failure the client's existing handler already knows how to
 * display -- see `+page.svelte`'s `onSuccess` else-branch, which reads
 * `result.data.form.errors`. Used for failures that happen BEFORE a real
 * sjsf `form` object exists (the schema fetch itself failing), where there
 * is no submitted-value form to hand back.
 *
 * Without this, those failures throw raw and reach the client as an
 * unparseable 500, which SvelteKit's `deserialize()` cannot turn into a
 * structured ActionResult -- so `use:enhance` falls back to its generic
 * `onFailure`, which has no field information and shows only "Something
 * went wrong while saving settings". That is not a UI polish gap: it also
 * silently drops whatever the user typed, because the client never
 * receives its own submitted value back to restore into the form.
 */
function infraFailure(message: string) {
    return fail(503, {
        form: {
            idPrefix: "root",
            isValid: false,
            updateData: false,
            errors: [{ path: [], message }]
        }
    });
}

export const actions = {
    default: async ({ request, fetch, locals }) => {
        // The autosave watcher retries on the next edit regardless, but a
        // dropped edit with no explanation reads as "autosave is broken" --
        // which is exactly the report that prompted this. A transient
        // backend hiccup (mid-deploy restart, a closed connection) must
        // surface as a normal, readable failure, not an opaque 500.
        let schema: unknown;
        try {
            schema = await getSchema(locals.backendUrl, locals.apiKey, fetch);
        } catch {
            return infraFailure(
                "Could not reach the backend to validate settings. Your edit was not saved -- try again in a moment."
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleForm = createFormHandler<any, true>({
            ...defaults,
            // @ts-expect-error - it's valid
            schema,
            sendData: true
        });

        let form: Awaited<ReturnType<typeof handleForm>>[0];
        try {
            [form] = await handleForm(request.signal, await request.formData());
        } catch {
            return infraFailure("Could not read the submitted settings. Your edit was not saved -- try again.");
        }

        if (!form.isValid) {
            return fail(400, { form });
        }

        let res: Awaited<ReturnType<typeof providers.riven.POST>>;
        try {
            res = await providers.riven.POST("/api/v1/settings/set/all", {
                body: form.data,
                baseUrl: locals.backendUrl,
                headers: {
                    "x-api-key": locals.apiKey
                },
                fetch: fetch
            });
        } catch {
            // The submitted value is still known-good here (`form` validated
            // above), so hand it back rather than falling to `infraFailure` --
            // the client re-applies it and the edit is not lost even though
            // the save itself did not complete.
            return fail(503, { form });
        }

        if (res.error) {
            return fail(500, { form });
        }

        return { form };
    }
} satisfies Actions;
