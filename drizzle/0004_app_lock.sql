CREATE TABLE `app_lock` (
	`user_id` text PRIMARY KEY NOT NULL,
	`pin_hash` text,
	`enabled` integer DEFAULT false NOT NULL,
	`timeout_minutes` integer DEFAULT 10 NOT NULL,
	`last_active_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
