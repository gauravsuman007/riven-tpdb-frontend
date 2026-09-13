CREATE TABLE `nav_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`hidden` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
