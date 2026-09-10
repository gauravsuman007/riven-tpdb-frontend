import * as z from "zod";

const typeEnum = z.enum(["movie", "show", "season", "episode", "anime"]);
const stateEnum = z.enum([
    "All",
    "Unknown",
    "Unreleased",
    "Ongoing",
    "Requested",
    "Indexed",
    "Scraped",
    "Downloaded",
    "Symlinked",
    "Completed",
    "PartiallyCompleted",
    "Failed",
    "Paused"
]);
const sortEnum = z.enum([
    "title_asc",
    "title_desc",
    "date_asc",
    "date_desc",
    "rating_asc",
    "rating_desc",
    "year_asc",
    "year_desc",
    "studio_asc",
    "studio_desc"
]);

/**
 * How the grid may be grouped.
 *
 * Grouping is paired with a sort on the same key, so a group's members are
 * contiguous. Grouping a page that is ordered by something else would repeat
 * the same heading down the page and split each group across every page --
 * headings that describe nothing.
 */
const groupEnum = z.enum(["none", "studio", "year", "state", "rating"]);

export const itemsSearchSchema = z.object({
    limit: z.coerce
        .number<number>()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit must be at most 100")
        .optional()
        .default(24),
    page: z.coerce.number<number>().min(1, "Page must be at least 1").optional().default(1),
    type: z
        .array(typeEnum)
        .min(1, "At least one type must be selected")
        .optional()
        .default(["movie", "show"]),
    states: z
        .array(stateEnum)
        .min(1, "At least one state must be selected")
        .optional()
        .default(["All"]),
    sort: z
        .array(sortEnum)
        .min(1, "At least one sort option must be selected")
        .optional()
        .default(["date_desc"]),
    group: groupEnum.optional().default("none"),
    search: z.string().min(1, "Search term must be at least 1 character").optional(),
    // Facet filters, set by picking a suggestion. Exact names, not substrings:
    // choosing a performer from the dropdown should show that performer's
    // titles, not everything their name happens to appear inside.
    performer: z.string().min(1).optional(),
    site: z.string().min(1).optional()
});

export type ItemsSearchSchema = z.infer<typeof itemsSearchSchema>;
export const typeOptions = typeEnum.enum;
export const stateOptions = stateEnum.enum;
export const sortOptions = sortEnum.enum;
export const groupOptions = groupEnum.enum;
export type GroupKey = z.infer<typeof groupEnum>;

/**
 * The sort a group implies. Choosing "by studio" and leaving the grid in
 * date order would scatter each studio across every page.
 */
export const GROUP_SORT: Record<GroupKey, z.infer<typeof sortEnum> | null> = {
    none: null,
    studio: "studio_asc",
    year: "year_desc",
    state: "title_asc",
    rating: "rating_desc"
};
