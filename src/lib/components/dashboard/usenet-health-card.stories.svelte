<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import UsenetHealthCard from "./usenet-health-card.svelte";

    const { Story } = defineMeta({
        title: "dashboard/UsenetHealthCard",
        component: UsenetHealthCard,
        tags: ["autodocs"],
        parameters: {
            docs: {
                description: {
                    component:
                        "The Reset/Rescan action buttons call `gqlClient` mutations directly and are inert in Storybook (no backend, no MSW handler registered for these operations yet)."
                }
            }
        }
    });
</script>

<script lang="ts">
    import type { UsenetTitleHealth, UsenetTitleHealthSummary } from "./types";

    const titles: UsenetTitleHealth[] = [
        {
            infoHash: "abc123",
            fileIndex: 0,
            mediaItemId: 42,
            status: "healthy",
            totalSegments: 500,
            sampledSegments: 50,
            missingSegments: 0,
            errorSegments: 0,
            missingPct: 0,
            checkedAt: Date.now() / 1000,
            repairAttempts: 0,
            nextRepairAt: null,
            title: "John Wick: Chapter 4",
            subtitle: null,
            posterPath: null,
            mediaType: "movie"
        },
        {
            infoHash: "def456",
            fileIndex: 0,
            mediaItemId: 43,
            status: "degraded",
            totalSegments: 800,
            sampledSegments: 80,
            missingSegments: 6,
            errorSegments: 2,
            missingPct: 7.5,
            checkedAt: Date.now() / 1000,
            repairAttempts: 1,
            nextRepairAt: Date.now() / 1000 + 3600,
            title: "Arcane",
            subtitle: "S02E05",
            posterPath: null,
            mediaType: "episode"
        }
    ];

    const summary: UsenetTitleHealthSummary = {
        healthy: 340,
        unhealthy: 12,
        notIngested: 3,
        unknown: 1,
        total: 356
    };
</script>

<Story name="Default" args={{ titles, summary }} />

<Story
    name="Empty"
    args={{
        titles: [],
        summary: { healthy: 0, unhealthy: 0, notIngested: 0, unknown: 0, total: 0 }
    }} />
