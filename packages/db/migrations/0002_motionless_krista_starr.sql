CREATE TABLE `focus_parse_history` (
	`user_id` text NOT NULL,
	`passage_id` text NOT NULL,
	`correct` integer DEFAULT 0 NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `passage_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `focus_passages` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`label` text,
	`book` text NOT NULL,
	`start_chapter` integer NOT NULL,
	`start_verse` integer NOT NULL,
	`end_chapter` integer NOT NULL,
	`end_verse` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
