ALTER TABLE `study_stats` ADD `study_streak` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `study_stats` ADD `last_session_date` text DEFAULT '' NOT NULL;