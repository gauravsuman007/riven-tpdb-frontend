import type { PluginInfo } from "./types";

export type Shape =
    | "boolean"
    | "number"
    | "string"
    | "string_array"
    | "bool_object"
    | "number_object"
    | "custom_rank_object"
    | "settings_section"
    | "unknown";

export function stringifyPluginFields(settings: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(
        Object.entries(settings).map(([key, value]) => [key, value == null ? "" : String(value)])
    );
}

export function pluginStatus(plugin: PluginInfo): {
    label: string;
    variant: "default" | "secondary";
} {
    if (!plugin.enabled) return { label: "Disabled", variant: "secondary" };
    if (plugin.valid) return { label: "Active", variant: "default" };
    return { label: "Invalid", variant: "secondary" };
}

export function detectShape(v: unknown): Shape {
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    if (Array.isArray(v)) {
        if (v.every((x) => typeof x === "string")) return "string_array";
        return "unknown";
    }
    if (v !== null && typeof v === "object") {
        const entries = Object.entries(v as object);
        if (entries.every(([, val]) => typeof val === "boolean")) return "bool_object";
        if (entries.every(([, val]) => typeof val === "number")) return "number_object";
        if (
            entries.length > 0 &&
            entries.every(
                ([, val]) => val !== null && typeof val === "object" && "fetch" in (val as object)
            )
        ) {
            return "custom_rank_object";
        }
        return "settings_section";
    }
    return "unknown";
}

export function toLabel(key: string): string {
    return key
        .replace(/^r(\d+p)$/, "$1")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
