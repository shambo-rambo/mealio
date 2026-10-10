CREATE TABLE `streak_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`achieved` integer NOT NULL,
	`value` real,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `streak_goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `streak_checkins_goal_date_idx` ON `streak_checkins` (`goal_id`,`date`);--> statement-breakpoint
CREATE INDEX `streak_checkins_user_date_idx` ON `streak_checkins` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `streak_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`target` real,
	`comparator` text DEFAULT 'gte' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_date` text NOT NULL,
	`archived_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `streak_goals_user_idx` ON `streak_goals` (`user_id`);