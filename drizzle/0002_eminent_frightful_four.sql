CREATE TABLE `playback_progress` (
	`user_id` text NOT NULL,
	`item_id` integer NOT NULL,
	`position_ticks` integer DEFAULT 0 NOT NULL,
	`runtime_ticks` integer,
	`played` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playback_progress_user_updated` ON `playback_progress` (`user_id`,`updated_at`);