ALTER TABLE `app_lock` ADD `lock_frontend` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `app_lock` ADD `lock_backend` integer DEFAULT false NOT NULL;