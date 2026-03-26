/**
 * HTTP file streaming is not available in the new Rust backend.
 * Media files are served via the FUSE virtual filesystem mount instead.
 */
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
    error(501, "HTTP file streaming is not supported. Access media via the VFS mount path.");
};
