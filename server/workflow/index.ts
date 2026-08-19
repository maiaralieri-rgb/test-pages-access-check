import * as db from "../db";
import { isFileStoreActive, mutateStore, readStore } from "../store/local-store";
import { DrizzleWorkflowRepository } from "./drizzle-repository";
import { InMemoryWorkflowRepository, type WorkflowRepository } from "./repository";
import { WorkflowService, type MembershipLookup } from "./service";

const membership: MembershipLookup = async (processId, accountId, stageKey) => {
  const member = await db.getProcessMember(processId, accountId, stageKey);
  return member ? { functionKey: member.functionKey, signatureOrder: member.signatureOrder } : undefined;
};

/**
 * MySQL when DATABASE_URL is configured; otherwise the file-backed store, which
 * keeps the shared-source guarantee within a single server process so the app
 * runs without provisioning a database.
 */
function createRepository(): WorkflowRepository {
  if (!isFileStoreActive()) return new DrizzleWorkflowRepository();
  return new InMemoryWorkflowRepository({
    load: () => {
      const state = readStore();
      return { documents: state.documents, signatures: state.signatures };
    },
    save: (state) => {
      mutateStore((store) => {
        store.documents = state.documents;
        store.signatures = state.signatures;
      });
    },
  });
}

let instance: WorkflowService | null = null;

export function getWorkflowService() {
  if (!instance) {
    instance = new WorkflowService({ repository: createRepository(), membership });
  }
  return instance;
}

export { WorkflowService } from "./service";
export type { WorkflowActor } from "./service";
