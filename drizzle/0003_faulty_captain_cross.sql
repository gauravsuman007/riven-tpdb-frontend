CREATE TABLE `direct_video_bookmark` (
	`user_id` text NOT NULL,
	`site` text NOT NULL,
	`video_id` text NOT NULL,
	`context_title` text NOT NULL,
	`title` text NOT NULL,
	`page_url` text NOT NULL,
	`thumbnail` text,
	`duration` integer,
	`resolution` text,
	`size` integer,
	`metadata_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `site`, `video_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `direct_video_bookmark_user_context` ON `direct_video_bookmark` (`user_id`,`context_title`,`created_at`);