CREATE TABLE `local_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`email` varchar(320) NOT NULL,
	`registrationId` varchar(80) NOT NULL,
	`role` enum('coordinator','signer','viewer') NOT NULL DEFAULT 'signer',
	`passwordHash` text NOT NULL,
	`passwordSalt` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp,
	CONSTRAINT `local_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_accounts_email_unique` UNIQUE(`email`),
	CONSTRAINT `local_accounts_registrationId_unique` UNIQUE(`registrationId`)
);
--> statement-breakpoint
CREATE TABLE `local_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `local_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `process_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`processId` varchar(128) NOT NULL,
	`accountId` int NOT NULL,
	`functionKey` varchar(80) NOT NULL,
	`stageId` varchar(64) NOT NULL,
	`signatureOrder` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `process_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registration_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`processId` varchar(128) NOT NULL,
	`stageId` varchar(64) NOT NULL,
	`functionKey` varchar(80) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `registration_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `registration_links_tokenHash_unique` UNIQUE(`tokenHash`)
);
