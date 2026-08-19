import { isFirebaseConfigured } from "../firebase/admin";
import { getIdentityProvider } from "../identity";
import { isFileStoreActive, mutateStore, readStore } from "../store/local-store";
import { DrizzleWorkflowRepository } from "./drizzle-repository";
import { FirestoreWorkflowRepository } from "./firestore-repository";
import { InMemoryWorkflowRepository, type WorkflowRepository } from "./repository";
import { WorkflowService, type MembershipLookup } from "./service";

/** Membership always comes from whichever identity provider is active. */
const membership: MembershipLookup = async (processId, accountId, stageKey) => {
  const member = await getIdentityProvider().getMembership(processId, accountId, stageKey);
  return member ? { functionKey: member.functionKey, signatureOrder: member.signatureOrder } : undefined;
};

/**
 * Storage precedence: Firestore when a Firebase project is configured, then
 * MySQL when DATABASE_URL is set, then the local file store so the app still
 * runs with nothing provisioned.
 */
function createRepository(): WorkflowRepository {
  if (isFirebaseConfigured()) return new FirestoreWorkflowRepository();
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

export function resetWorkflowService() {
  instance = null;
}

export function describeWorkflowStorage() {
  if (isFirebaseConfigured()) return "Firestore";
  if (!isFileStoreActive()) return "MySQL";
  return "arquivo local";
}

export { WorkflowService } from "./service";
export type { WorkflowActor } from "./service";
