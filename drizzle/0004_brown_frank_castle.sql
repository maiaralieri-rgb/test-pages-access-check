ALTER TABLE `process_events` MODIFY COLUMN `accountId` varchar(128);--> statement-breakpoint
ALTER TABLE `process_members` MODIFY COLUMN `accountId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `process_signatures` MODIFY COLUMN `accountId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `processes` MODIFY COLUMN `createdByAccountId` varchar(128);