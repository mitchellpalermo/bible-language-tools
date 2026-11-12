ALTER TABLE `focus_passages` ADD `language` text DEFAULT 'greek' NOT NULL;--> statement-breakpoint
ALTER TABLE `focus_passages` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `focus_passages` ADD `deleted_at` text;