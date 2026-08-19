CREATE TABLE `process_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventKey` varchar(64) NOT NULL,
	`processId` varchar(128) NOT NULL,
	`actor` varchar(180) NOT NULL,
	`type` enum('created','saved','signed','forwarded','reminder','skipped') NOT NULL,
	`description` text NOT NULL,
	`hash` varchar(128),
	`accountId` int,
	`at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `process_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `process_events_eventKey_unique` UNIQUE(`eventKey`)
);
--> statement-breakpoint
CREATE TABLE `process_signatures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`processId` varchar(128) NOT NULL,
	`stageKey` varchar(64) NOT NULL,
	`accountId` int NOT NULL,
	`signerName` varchar(180) NOT NULL,
	`signerRegistrationId` varchar(80) NOT NULL,
	`functionKey` varchar(80) NOT NULL,
	`signatureOrder` int NOT NULL,
	`integrityHash` varchar(128) NOT NULL,
	`documentVersion` int NOT NULL,
	`idempotencyKey` varchar(128) NOT NULL,
	`provider` varchar(64) NOT NULL DEFAULT 'local-evidence',
	`providerReference` text,
	`signedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `process_signatures_id` PRIMARY KEY(`id`),
	CONSTRAINT `process_signatures_idempotencyKey_unique` UNIQUE(`idempotencyKey`),
	CONSTRAINT `process_signatures_process_stage_idx` UNIQUE(`processId`,`stageKey`)
);
--> statement-breakpoint
CREATE TABLE `process_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`processId` varchar(128) NOT NULL,
	`stageKey` varchar(64) NOT NULL,
	`stageOrder` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`role` varchar(180) NOT NULL,
	`signerName` varchar(180) NOT NULL,
	`optional` boolean NOT NULL DEFAULT false,
	`status` enum('waiting','active','signed','skipped') NOT NULL DEFAULT 'waiting',
	`fields` json,
	`signedAt` timestamp,
	`integrityHash` varchar(128),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `process_stages_id` PRIMARY KEY(`id`),
	CONSTRAINT `process_stages_process_stage_idx` UNIQUE(`processId`,`stageKey`)
);
--> statement-breakpoint
CREATE TABLE `processes` (
	`id` varchar(128) NOT NULL,
	`protocol` varchar(180) NOT NULL,
	`candidateName` varchar(180) NOT NULL,
	`candidateRank` varchar(120) NOT NULL,
	`grade` varchar(80) NOT NULL,
	`opm` varchar(180) NOT NULL,
	`status` enum('in_progress','completed') NOT NULL DEFAULT 'in_progress',
	`source` varchar(40) NOT NULL DEFAULT 'PM-COM-002',
	`certificationState` varchar(64) NOT NULL DEFAULT 'evidence_pending_qualification',
	`version` int NOT NULL DEFAULT 1,
	`createdByAccountId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `process_events_process_idx` ON `process_events` (`processId`);