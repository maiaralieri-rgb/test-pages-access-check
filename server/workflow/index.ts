import * as db from "../db";
import { DrizzleWorkflowRepository } from "./drizzle-repository";
import { WorkflowService, type MembershipLookup } from "./service";

const membership: MembershipLookup = async (processId, accountId, stageKey) => {
  const member = await db.getProcessMember(processId, accountId, stageKey);
  return member ? { functionKey: member.functionKey, signatureOrder: member.signatureOrder } : undefined;
};

let instance: WorkflowService | null = null;

/** Production wiring: shared MySQL source plus the memberships created by stage invites. */
export function getWorkflowService() {
  if (!instance) {
    instance = new WorkflowService({ repository: new DrizzleWorkflowRepository(), membership });
  }
  return instance;
}

export { WorkflowService } from "./service";
export type { WorkflowActor } from "./service";
