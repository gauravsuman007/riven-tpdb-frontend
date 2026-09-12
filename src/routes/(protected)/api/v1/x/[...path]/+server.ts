import { error } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";

/*
    Byte-for-byte passthrough to the backend, for everything an add-on serves.

    The generic proxy next door (`api/[...backendProxy]`) ends every response
    with `json(await response.json())`, which is right for an API and wrong for
    everything else: it decodes the body, throws away the content type, and
    cannot do Range at all. That silently broke OnlyFans video playback -- a
    <video> pointed at a stream endpoint got a 500 with a JSON body -- and it
    would equally have broken an add-on's compiled page bundle, its stylesheet,
    and its proxied images.

    So everything under the add-on prefix comes through here instead. One rule
    covers all three because all three are the same thing: bytes the backend
    already labelled correctly, which this must not touch.

    SvelteKit prefers this more specific route over the catch-all, so adding it
    took nothing away from the generic proxy.
*/

//: Forwarded from the client. Range is what makes seeking work at all;
//: without it the player can only ever play from the start.
const FORWARD_REQUEST = ["range", "if-range", "accept", "content-type"];

//: Returned to the client. Content-Range and Accept-Ranges have to survive or
//: the browser does not believe the 206 it was just given.
const FORWARD_RESPONSE = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "etag",
    "last-modified",
    "content-disposition"
];

const passthrough = async (
    method: string,
    locals: App.Locals,
    url: URL,
    request: Request
): Promise<Response> => {
    const target = new URL(url.pathname, locals.backendUrl);

    const headers = new Headers({ "x-api-key": locals.apiKey });

    for (const name of FORWARD_REQUEST) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }

    let upstream: Response;

    try {
        upstream = await fetch(`${target}${url.search}`, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : await request.blob(),
            // Streamed rather than buffered: an add-on's video endpoint can
            // serve hundreds of megabytes, and buffering it here would hold
            // the whole thing in the Node process before sending any of it.
            // @ts-expect-error - undici accepts this; the DOM types do not
            duplex: "half"
        });
    } catch {
        throw error(502, "Add-on backend did not answer");
    }

    const out = new Headers();

    for (const name of FORWARD_RESPONSE) {
        const value = upstream.headers.get(name);
        if (value) out.set(name, value);
    }

    return new Response(upstream.body, { status: upstream.status, headers: out });
};

export const GET: RequestHandler = ({ locals, url, request }) =>
    passthrough("GET", locals, url, request);
export const HEAD: RequestHandler = ({ locals, url, request }) =>
    passthrough("HEAD", locals, url, request);
export const POST: RequestHandler = ({ locals, url, request }) =>
    passthrough("POST", locals, url, request);
export const PUT: RequestHandler = ({ locals, url, request }) =>
    passthrough("PUT", locals, url, request);
export const DELETE: RequestHandler = ({ locals, url, request }) =>
    passthrough("DELETE", locals, url, request);
