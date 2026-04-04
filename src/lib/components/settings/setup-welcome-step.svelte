<script lang="ts">
    let {
        validPlugins,
        totalPlugins,
        enabledProfileCount,
        missingRequiredConfig
    }: {
        validPlugins: number;
        totalPlugins: number;
        enabledProfileCount: number;
        missingRequiredConfig: number;
    } = $props();
</script>

<div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
    <div class="space-y-6">
        <div>
            <h2 class="text-3xl font-semibold tracking-tight">Before you continue</h2>
            <p class="text-muted-foreground mt-3 max-w-3xl text-sm">
                Riven still needs a few frontend boot variables outside the app, but the operational
                parts of setup happen here. Treat this like installation, not regular settings.
            </p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-2xl border p-5">
                <p class="font-medium">Still external</p>
                <p class="text-muted-foreground mt-2 text-sm">
                    `BACKEND_URL`, `BACKEND_API_KEY`, `DATABASE_URL`, `AUTH_SECRET`, and `ORIGIN`.
                </p>
            </div>
            <div class="rounded-2xl border p-5">
                <p class="font-medium">Configured here</p>
                <p class="text-muted-foreground mt-2 text-sm">
                    Media servers, content providers, metadata services, runtime defaults, and
                    quality profiles.
                </p>
            </div>
        </div>
    </div>

    <div class="grid gap-4">
        <div class="rounded-2xl border p-5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Plugins</p>
            <p class="mt-2 text-3xl font-semibold">{validPlugins}/{totalPlugins}</p>
            <p class="text-muted-foreground text-sm">enabled plugins currently valid</p>
        </div>
        <div class="rounded-2xl border p-5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Profiles
            </p>
            <p class="mt-2 text-3xl font-semibold">{enabledProfileCount}</p>
            <p class="text-muted-foreground text-sm">quality profiles enabled</p>
        </div>
        <div class="rounded-2xl border p-5">
            <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Attention Needed
            </p>
            <p class="mt-2 text-3xl font-semibold">{missingRequiredConfig}</p>
            <p class="text-muted-foreground text-sm">enabled plugins missing required fields</p>
        </div>
    </div>
</div>
