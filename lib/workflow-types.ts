import type { WorkflowStage } from "./workflow-rules";

export type AuditEventType = "created" | "saved" | "signed" | "forwarded" | "reminder" | "skipped";

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  type: AuditEventType;
  description: string;
  hash?: string;
};

export type WorkflowDocument = {
  id: string;
  protocol: string;
  candidateName: string;
  candidateRank: string;
  grade: string;
  opm: string;
  status: "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
  source: "PM-COM-002";
  certificationState: "evidence_pending_qualification";
  /** Bumped by every mutation; signatures pin it to detect concurrent edits. */
  version: number;
  stages: WorkflowStage[];
  events: AuditEvent[];
};

export type CreateWorkflowInput = {
  protocol: string;
  candidateName: string;
  candidateRank: string;
  grade: string;
  opm: string;
};
