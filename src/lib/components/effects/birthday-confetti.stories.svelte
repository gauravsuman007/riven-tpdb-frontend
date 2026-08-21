<script module>
    import { defineMeta } from "@storybook/addon-svelte-csf";
    import BirthdayConfetti from "./birthday-confetti.svelte";

    const { Story } = defineMeta({
        title: "effects/BirthdayConfetti",
        component: BirthdayConfetti,
        tags: ["autodocs"],
        parameters: {
            layout: "fullscreen"
        }
    });
</script>

<Story name="Active" asChild>
    <div class="relative h-96 w-full overflow-hidden bg-black">
        <BirthdayConfetti active={true} />
    </div>
</Story>

<Story name="Inactive" asChild>
    <div class="relative h-96 w-full overflow-hidden bg-black">
        <BirthdayConfetti active={false} />
    </div>
</Story>
