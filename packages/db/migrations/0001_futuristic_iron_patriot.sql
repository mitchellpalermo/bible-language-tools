CREATE TABLE `sync_state` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`synced_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `language`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `id_token` text;--> statement-breakpoint
ALTER TABLE `users` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `image` text;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` integer DEFAULT 0 NOT NULL;