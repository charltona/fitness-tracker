ALTER TABLE `workouts` ADD `paused` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `elapsed_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `last_active_time` integer;