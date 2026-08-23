import type { UiSchemaRoot } from "@sjsf/form";
import MaskedSecret from "./masked-secret.svelte";

/**
 * Field names that hold credentials. Matched case-insensitively against the
 * leaf key, so `api_key`, `api_token`, `rclone_password` etc. all qualify.
 */
const SECRET_KEY_PATTERN = /(api_?key|token|password|secret|passkey)$/i;

/**
 * Build a uiSchema that renders every credential field with the masked widget.
 *
 * This walks the *settings value* rather than the JSON schema because the
 * schema is `$ref`-heavy, while `getUiSchemaByPath` resolves by data path --
 * so mirroring the value's shape is both simpler and exact.
 */
export function buildSecretUiSchema(value: unknown): UiSchemaRoot {
    const walk = (node: unknown): Record<string, unknown> | undefined => {
        if (node === null || typeof node !== "object" || Array.isArray(node)) return undefined;

        let out: Record<string, unknown> | undefined;

        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
            if (typeof child === "string" && SECRET_KEY_PATTERN.test(key)) {
                (out ??= {})[key] = { "ui:components": { textWidget: MaskedSecret } };
                continue;
            }

            const nested = walk(child);
            if (nested) (out ??= {})[key] = nested;
        }

        return out;
    };

    return (walk(value) ?? {}) as UiSchemaRoot;
}
