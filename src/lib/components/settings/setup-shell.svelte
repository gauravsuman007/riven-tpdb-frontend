<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { Button } from "$lib/components/ui/button/index.js";

    type Step = {
        id: string;
        label: string;
        description: string;
    };

    let {
        steps,
        stepIndex,
        setupReady,
        goToStep,
        previousStep,
        nextStep,
        children
    }: {
        steps: Step[];
        stepIndex: number;
        setupReady: boolean;
        goToStep: (index: number) => void;
        previousStep: () => void;
        nextStep: () => void;
        children: () => any;
    } = $props();
</script>

<div class="bg-background flex min-h-[calc(100vh-5rem)] flex-col">
    <div class="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8 md:px-10">
        <aside class="hidden w-72 shrink-0 lg:block">
            <div class="bg-card sticky top-8 rounded-3xl border p-5">
                <p class="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
                    Initial Setup
                </p>
                <h1 class="mt-3 text-3xl font-semibold tracking-tight">Walkthrough</h1>
                <p class="text-muted-foreground mt-3 text-sm">
                    This is a separate first-run flow. Configure the instance once, then use normal
                    settings later for maintenance.
                </p>
                <div class="mt-6 space-y-2">
                    {#each steps as step, index}
                        <button
                            type="button"
                            onclick={() => goToStep(index)}
                            class="w-full rounded-2xl border px-4 py-3 text-left transition-colors {index ===
                            stepIndex
                                ? 'border-primary bg-primary/5'
                                : 'hover:bg-muted/40'}">
                            <p class="text-muted-foreground text-xs tracking-wide uppercase">
                                Step {index + 1}
                            </p>
                            <p class="mt-1 font-medium">{step.label}</p>
                            <p class="text-muted-foreground mt-1 text-xs">{step.description}</p>
                        </button>
                    {/each}
                </div>
            </div>
        </aside>

        <main class="min-w-0 flex-1">
            <div class="mb-6 flex flex-wrap items-start justify-between gap-4 lg:hidden">
                <div>
                    <p
                        class="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
                        Initial Setup
                    </p>
                    <h1 class="mt-2 text-3xl font-semibold tracking-tight">
                        {steps[stepIndex].label}
                    </h1>
                </div>
                <Badge variant={setupReady ? "default" : "secondary"}>
                    {setupReady ? "Ready" : "Needs attention"}
                </Badge>
            </div>

            <section class="bg-card rounded-3xl border p-6 md:p-8">
                {@render children()}
            </section>

            <div class="mt-6 flex items-center justify-between">
                <Button
                    type="button"
                    variant="outline"
                    disabled={stepIndex === 0}
                    onclick={previousStep}>
                    Previous
                </Button>
                <div class="text-muted-foreground text-sm">
                    Step {stepIndex + 1} of {steps.length}
                </div>
                <Button type="button" disabled={stepIndex === steps.length - 1} onclick={nextStep}>
                    Next
                </Button>
            </div>
        </main>
    </div>
</div>
