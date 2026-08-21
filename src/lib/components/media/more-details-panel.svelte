<script lang="ts">
    import SectionHeading from "./section-heading.svelte";

    interface Props {
        budget?: number | null;
        revenue?: number | null;
        originCountry?: string[];
        spokenLanguages?: { english_name: string | null }[] | null;
        productionCompanies?: { name: string }[];
        homepage?: string | null;
        imdbId?: string | null;
        externalLinks: Array<{ key: string; label: string; url: string }>;
    }

    let {
        budget,
        revenue,
        originCountry,
        spokenLanguages,
        productionCompanies,
        homepage,
        imdbId,
        externalLinks
    }: Props = $props();

    const formatCurrency = (n: number) =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }).format(n);
</script>

<div class="min-w-0 flex-1">
    <SectionHeading title="More Details" />
    <div class="flex flex-col gap-6 text-sm">
        <!-- Financials Row -->
        {#if budget || revenue}
            <div class="flex flex-wrap gap-12">
                {#if budget}
                    <div class="flex min-w-30 flex-col gap-1">
                        <span
                            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                            >Budget</span>
                        <span class="text-foreground font-mono">{formatCurrency(budget)}</span>
                    </div>
                {/if}
                {#if revenue}
                    <div class="flex min-w-30 flex-col gap-1">
                        <span
                            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                            >Revenue</span>
                        <span class="text-foreground font-mono">{formatCurrency(revenue)}</span>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Region & Language Row -->
        {#if originCountry?.length || spokenLanguages?.length}
            <div class="flex flex-wrap gap-12">
                {#if originCountry?.length}
                    <div class="flex min-w-30 flex-col gap-1">
                        <span
                            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                            >Origin</span>
                        <span class="text-foreground">{originCountry.join(", ")}</span>
                    </div>
                {/if}
                {#if spokenLanguages?.length}
                    <div class="flex min-w-30 flex-col gap-1">
                        <span
                            class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                            >Languages</span>
                        <span class="text-foreground"
                            >{spokenLanguages.map((l) => l.english_name).join(", ")}</span>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Production Companies -->
        {#if productionCompanies?.length}
            <div class="flex flex-col gap-2">
                <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                    >Production</span>
                <div class="flex flex-wrap gap-2">
                    {#each productionCompanies as company, i (i)}
                        <span
                            class="text-muted-foreground rounded border border-white/10 bg-white/5 px-2 py-1 text-xs">
                            {company.name}
                        </span>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- External Links -->
        {#if homepage || imdbId || externalLinks.length}
            <div class="flex flex-col gap-2">
                <span class="text-muted-foreground text-xs font-semibold tracking-wider uppercase"
                    >Links</span>
                <div class="flex flex-wrap gap-2">
                    {#if homepage}
                        <a
                            href={homepage}
                            target="_blank"
                            rel="external noopener noreferrer"
                            class="text-foreground rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                            >Website</a>
                    {/if}
                    {#if imdbId}
                        <a
                            href="https://www.imdb.com/title/{imdbId}/parentalguide/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-foreground rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                            >Parental Guide</a>
                    {/if}
                    {#each externalLinks as link (link.key)}
                        <a
                            href={link.url}
                            target="_blank"
                            rel="external noopener noreferrer"
                            class="text-foreground rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10"
                            >{link.label}</a>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>
