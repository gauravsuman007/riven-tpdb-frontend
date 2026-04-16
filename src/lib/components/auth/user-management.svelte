<script lang="ts">
    import * as Form from "$lib/components/ui/form/index.js";
    import { Input } from "$lib/components/ui/input/index.js";
    import * as Table from "$lib/components/ui/table/index.js";
    import { Badge } from "$lib/components/ui/badge/index.js";
    import type { SuperValidated } from "sveltekit-superforms";
    import { superForm } from "sveltekit-superforms";
    import { zod4Client } from "sveltekit-superforms/adapters";
    import { toast } from "svelte-sonner";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import { page } from "$app/state";
    import { createUserSchema, type CreateUserSchema } from "$lib/schemas/auth";
    import * as dateUtils from "$lib/utils/date";
    import FormBase from "./form-base.svelte";

    type ManagedUser = {
        id: string;
        name: string;
        email: string;
        username?: string | null;
        role?: string | null;
        banned?: boolean | null;
        createdAt?: Date | string | number | null;
    };

    let {
        formData: initialForm,
        users
    }: {
        formData: SuperValidated<CreateUserSchema>;
        users: ManagedUser[];
    } = $props();

    const form = superForm(initialForm, {
        validators: zod4Client(createUserSchema),
        resetForm: true
    });

    const { form: formData, enhance, message, delayed } = form;

    function formatCreatedAt(value: ManagedUser["createdAt"]) {
        if (!value) return "Unknown";

        const dateString = value instanceof Date ? value.toISOString() : String(value);
        return dateUtils.formatDate(dateString) ?? "Unknown";
    }

    $effect(() => {
        if ($message) {
            if (page.status >= 200 && page.status < 300) {
                toast.success($message);
            } else {
                toast.error($message);
            }
        }
    });
</script>

<FormBase
    title="User Management"
    description="Create local credential users and choose their access role."
    class="gap-6">
    {#snippet content()}
        <form method="POST" use:enhance action="?/createUser" class="grid gap-4 md:grid-cols-2">
            <Form.Field {form} name="username">
                <Form.Control>
                    {#snippet children({ props })}
                        <Form.Label for="username">Username</Form.Label>
                        <Input placeholder="new-user" {...props} bind:value={$formData.username} />
                    {/snippet}
                </Form.Control>
                <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="email">
                <Form.Control>
                    {#snippet children({ props })}
                        <Form.Label for="email">Email</Form.Label>
                        <Input
                            type="email"
                            placeholder="user@example.com"
                            {...props}
                            bind:value={$formData.email} />
                    {/snippet}
                </Form.Control>
                <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="password">
                <Form.Control>
                    {#snippet children({ props })}
                        <Form.Label for="password">Password</Form.Label>
                        <Input
                            type="password"
                            autocomplete="new-password"
                            {...props}
                            bind:value={$formData.password} />
                    {/snippet}
                </Form.Control>
                <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="confirmPassword">
                <Form.Control>
                    {#snippet children({ props })}
                        <Form.Label for="confirmPassword">Confirm Password</Form.Label>
                        <Input
                            type="password"
                            autocomplete="new-password"
                            {...props}
                            bind:value={$formData.confirmPassword} />
                    {/snippet}
                </Form.Control>
                <Form.FieldErrors />
            </Form.Field>

            <Form.Field {form} name="role">
                <Form.Control>
                    {#snippet children({ props })}
                        <Form.Label for="role">Role</Form.Label>
                        <select
                            {...props}
                            bind:value={$formData.role}
                            class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                            <option value="user">User</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    {/snippet}
                </Form.Control>
                <Form.Description>
                    Managers can maintain the library. Admins can also access settings and users.
                </Form.Description>
                <Form.FieldErrors />
            </Form.Field>
        </form>

        <div class="mt-8 overflow-hidden rounded-lg border">
            <Table.Root>
                <Table.Header>
                    <Table.Row>
                        <Table.Head>User</Table.Head>
                        <Table.Head>Role</Table.Head>
                        <Table.Head>Created</Table.Head>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {#each users as user (user.id)}
                        <Table.Row>
                            <Table.Cell>
                                <div class="font-medium">{user.username ?? user.name}</div>
                                <div class="text-muted-foreground text-xs">{user.email}</div>
                            </Table.Cell>
                            <Table.Cell>
                                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                                    {user.role ?? "user"}
                                </Badge>
                            </Table.Cell>
                            <Table.Cell class="text-muted-foreground text-sm">
                                {formatCreatedAt(user.createdAt)}
                            </Table.Cell>
                        </Table.Row>
                    {:else}
                        <Table.Row>
                            <Table.Cell colspan={3} class="text-muted-foreground text-center">
                                No users found.
                            </Table.Cell>
                        </Table.Row>
                    {/each}
                </Table.Body>
            </Table.Root>
        </div>
    {/snippet}

    {#snippet footer()}
        <Form.Button
            variant="secondary"
            size="sm"
            disabled={$delayed}
            onclick={() => {
                form.submit();
            }}>
            {#if $delayed}
                <LoaderCircle class="mr-2 h-5 w-5 animate-spin" />
            {/if}
            Create user
        </Form.Button>
    {/snippet}
</FormBase>
