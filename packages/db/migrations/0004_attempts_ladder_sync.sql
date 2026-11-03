CREATE TABLE `attempts` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`id` text NOT NULL,
	`concept` text NOT NULL,
	`correct` integer NOT NULL,
	`ms` integer,
	`confidence` integer,
	`at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `language`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_user_language_at` ON `attempts` (`user_id`,`language`,`at`);--> statement-breakpoint
CREATE TABLE `ladder_progress` (
	`user_id` text NOT NULL,
	`language` text NOT NULL,
	`rung_id` text NOT NULL,
	`clean_writes` integer NOT NULL,
	PRIMARY KEY(`user_id`, `language`, `rung_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
