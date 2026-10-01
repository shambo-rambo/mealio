CREATE TABLE `item_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_name` text,
	`recipe_id` text,
	`amount` text DEFAULT '' NOT NULL,
	`quantity` real,
	`unit` text,
	`selected` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `shopping_items`(`id`) ON UPDATE no action ON DELETE cascade
);
