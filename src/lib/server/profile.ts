/*
    The profile screen's data and its four form actions.

    Lifted out of `routes/(protected)/auth/+page.server.ts` when the profile
    became a tab on the settings page: the forms post with a relative
    `?/passwordChange`, so their actions have to be registered by whichever
    route renders them. That route is `/settings` now, and it re-exports
    these. The markup is `$lib/components/settings/profile-panel.svelte`.

    Kept as its own module rather than pasted into the settings loader --
    changing your password has nothing to do with the backend settings form
    it now shares a page with, and reading the two together would suggest it
    does.
*/

import type { RequestEvent } from "@sveltejs/kit";
import { redirect } from "@sveltejs/kit";
import { getAuthProviders } from "$lib/server/auth";
import {
    passwordChangeSchema,
    emailChangeSchema,
    setPasswordSchema,
    changeUserDataSchema
} from "$lib/schemas/auth";
import { zod4 } from "sveltekit-superforms/adapters";
import { message, superValidate, fail, setError } from "sveltekit-superforms";
import { auth } from "$lib/server/auth";
import { APIError } from "better-auth/api";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("auth-settings");

export async function loadProfile(event: RequestEvent) {
    if (!event.locals.user || !event.locals.session) {
        redirect(302, "/auth/login");
    }

    const passwordChangeForm = await superValidate(zod4(passwordChangeSchema));
    const emailChangeForm = await superValidate(zod4(emailChangeSchema));
    const setPasswordForm = await superValidate(zod4(setPasswordSchema));
    const changeUserDataForm = await superValidate(zod4(changeUserDataSchema));

    const accounts = await auth.api.listUserAccounts({
        headers: event.request.headers
    });

    return {
        user: event.locals.user,
        session: event.locals.session,
        authProviders: getAuthProviders(),
        accounts,
        passwordChangeForm,
        emailChangeForm,
        setPasswordForm,
        changeUserDataForm
    };
}

export const profileActions = {
    passwordChange: async ({ request }: RequestEvent) => {
        const passwordChangeForm = await superValidate(request, zod4(passwordChangeSchema));

        if (!passwordChangeForm.valid) return fail(400, { passwordChangeForm });

        if (passwordChangeForm.data.oldPassword === passwordChangeForm.data.newPassword) {
            return setError(
                passwordChangeForm,
                "newPassword",
                "New password must be different from old password."
            );
        }

        try {
            await auth.api.changePassword({
                body: {
                    newPassword: passwordChangeForm.data.newPassword,
                    currentPassword: passwordChangeForm.data.oldPassword,
                    revokeOtherSessions: passwordChangeForm.data.revokeSessions
                },
                headers: request.headers
            });
        } catch (error) {
            if (error instanceof APIError) {
                return message(passwordChangeForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during password change:", error);
            return message(passwordChangeForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return message(passwordChangeForm, "Password changed successfully.");
    },
    setPassword: async ({ request }: RequestEvent) => {
        const setPasswordForm = await superValidate(request, zod4(setPasswordSchema));

        if (!setPasswordForm.valid) return fail(400, { setPasswordForm });

        try {
            await auth.api.setPassword({
                body: {
                    newPassword: setPasswordForm.data.newPassword
                },
                headers: request.headers
            });
        } catch (error) {
            if (error instanceof APIError) {
                return message(setPasswordForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during setting password:", error);
            return message(setPasswordForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return message(setPasswordForm, "Password set successfully.");
    },
    emailChange: async ({ request }: RequestEvent) => {
        const emailChangeForm = await superValidate(request, zod4(emailChangeSchema));

        if (!emailChangeForm.valid) return fail(400, { emailChangeForm });

        try {
            await auth.api.changeEmail({
                body: {
                    newEmail: emailChangeForm.data.newEmail
                },
                headers: request.headers
            });
        } catch (error) {
            if (error instanceof APIError) {
                return message(emailChangeForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during email change:", error);
            return message(emailChangeForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return message(emailChangeForm, "Email change request successful.");
    },
    updateUserData: async ({ request, locals }: RequestEvent) => {
        const changeUserDataForm = await superValidate(request, zod4(changeUserDataSchema));

        if (!changeUserDataForm.valid) return fail(400, { changeUserDataForm });

        try {
            const formData = changeUserDataForm.data;

            if (formData.newUsername && formData.newUsername !== locals.user.username) {
                const usernameCheckResponse = await auth.api.isUsernameAvailable({
                    body: {
                        username: formData.newUsername
                    }
                });

                if (!usernameCheckResponse?.available) {
                    return setError(
                        changeUserDataForm,
                        "newUsername",
                        "This username is already taken."
                    );
                }
            }

            const updatePayload: Record<string, string> = {};

            if (formData.newUsername && formData.newUsername.trim() !== "") {
                updatePayload.username = formData.newUsername;
            }

            if (formData.newName && formData.newName.trim() !== "") {
                updatePayload.name = formData.newName;
            }

            if (formData.newAvatar && formData.newAvatar.trim() !== "") {
                updatePayload.image = formData.newAvatar;
            }

            if (Object.keys(updatePayload).length > 0) {
                await auth.api.updateUser({
                    body: updatePayload,
                    headers: request.headers
                });
            }
        } catch (error) {
            if (error instanceof APIError) {
                return message(changeUserDataForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during user data update:", error);
            return message(changeUserDataForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return message(changeUserDataForm, "User data updated successfully.");
    }
};
