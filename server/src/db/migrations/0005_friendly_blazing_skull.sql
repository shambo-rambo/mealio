ALTER TABLE `ingredients` ADD `food_group` text;--> statement-breakpoint
ALTER TABLE `item_history` ADD `aisle` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `meal_type` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `effort` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `protein` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `cuisine` text;--> statement-breakpoint
ALTER TABLE `recipes` ADD `kid_friendly` integer;--> statement-breakpoint
ALTER TABLE `recipes` ADD `allergens` text;--> statement-breakpoint
ALTER TABLE `shopping_items` ADD `aisle` text;