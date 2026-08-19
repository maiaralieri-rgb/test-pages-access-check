import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { type PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { isFirebaseEnabled, subscribeToAuthChanges } from "@/lib/firebase-client";
import { trpc } from "@/lib/trpc";
import { resolveWorkflowSource } from "@/lib/workflow-source";
import {
  canEditStage,
  createStages,
  getNextPendingStage,
  isWorkflowComplete,
  nextStatuses,
} from "@/lib/workflow-rules";
import type { AuditEvent, CreateWorkflowInput, WorkflowDocument } from "@/lib/workflow-types";

export type { AuditEvent, CreateWorkflowInput, WorkflowDocument } from "@/lib/workflow-types";

const STORAGE_KEY = "assinafluxo.workflow.v1";

/**
 * "server" is the shared source of truth used whenever the account is signed in
 * and the API answers. "local" is the original browser-only prototype mode,
 * kept as a fallback so the app still opens without a database configured.
 */
export type WorkflowSource = "server" | "local";

type WorkflowContextValue = {
  documents: WorkflowDocument[];
  isReady: boolean;
  source: WorkflowSource;
  /** True while the shared source is unavailable, so the UI can warn the user. */
  isLocalFallback: boolean;
  /** Firebase is configured but nobody is signed in: no local copy is offered. */
  requiresSignIn: boolean;
  getDocument: (id: string) => WorkflowDocument | undefined;
  createWorkflow: (input: CreateWorkflowInput) => Promise<string>;
  updateStage: (documentId: string, stageId: string, fields: Record<string, string | boolean>) => Promise<void>;
  signActiveStage: (documentId: string, stageId: string, fields?: Record<string, string | boolean>) => Promise<void>;
  skipActiveStage: (documentId: string, stageId: string) => Promise<void>;
  sendReminder: (documentId: string) => Promise<void>;
  refresh: () => Promise<unknown>;
};

const WorkflowContext = createContext<WorkflowContextValue | undefined>(undefined);

const isoNow = () => new Date().toISOString();

function makeEvent(actor: string, type: AuditEvent["type"], description: string, hash?: string): AuditEvent {
  return { id: Crypto.randomUUID(), at: isoNow(), actor, type, description, hash };
}

function sampleDocument(): WorkflowDocument {
  const now = isoNow();
  const stages = createStages();
  const indicationHash = "d1b7e3a8b6e2f4a0c97f4d928654b5ae";
  stages[0] = {
    ...stages[0],
    status: "signed",
    signedAt: "2026-08-15T13:20:00.000Z",
    integrityHash: indicationHash,
    fields: {
      sintese: "Atuação destacada em ocorrência operacional e relevante histórico funcional.",
      extemporaneidade: "Não aplicável",
    },
  };
  stages[1] = {
    ...stages[1],
    status: "active",
    fields: {
      tempoServico: "14 anos e 8 meses",
      grauAnterior: "4º grau",
      avaliacao: "Superior",
      requisitos: true,
    },
  };

  return {
    id: "lmp-2026-041",
    protocol: "SEI/SP 041/2026",
    candidateName: "Sd. Luís Henrique Alves",
    candidateRank: "Soldado PM",
    grade: "3º grau",
    opm: "7º BPM/M",
    status: "in_progress",
    createdAt: "2026-08-15T12:40:00.000Z",
    updatedAt: now,
    source: "PM-COM-002",
    certificationState: "evidence_pending_qualification",
    version: 1,
    stages,
    events: [
      { id: "evt-1", at: "2026-08-15T12:40:00.000Z", actor: "Cap. Marina Souto", type: "created", description: "Processo LMP criado a partir do modelo PM-COM-002." },
      { id: "evt-2", at: "2026-08-15T13:20:00.000Z", actor: "Cap. Marina Souto", type: "signed", description: "Etapa de indicação assinada e bloqueada.", hash: indicationHash },
      { id: "evt-3", at: "2026-08-15T13:20:01.000Z", actor: "Sistema", type: "forwarded", description: "Informações pessoais liberadas para Cap. Bruno Azevedo." },
    ],
  };
}

function canonicalStagePayload(document: WorkflowDocument, stage: WorkflowDocument["stages"][number]) {
  return JSON.stringify({
    documentId: document.id,
    protocol: document.protocol,
    source: document.source,
    candidate: document.candidateName,
    stageId: stage.id,
    stageOrder: stage.order,
    signer: stage.signerName,
    fields: Object.entries(stage.fields).sort(([a], [b]) => a.localeCompare(b)),
  });
}

export function WorkflowProvider({ children }: PropsWithChildren) {
  const [localDocuments, setLocalDocuments] = useState<WorkflowDocument[]>([]);
  const [localReady, setLocalReady] = useState(false);

  const utils = trpc.useUtils();
  const session = trpc.localAuth.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const isAuthenticated = Boolean(session.data);
  const firebaseMode = isFirebaseEnabled();

  const remote = trpc.workflow.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5_000,
    // Keeps a second browser in step without a manual reload.
    refetchInterval: 15_000,
  });

  // Sign-in and sign-out only take effect asynchronously in the Firebase SDK;
  // without this the app would keep showing the pre-login state.
  useEffect(() => {
    if (!firebaseMode) return;
    return subscribeToAuthChanges(() => {
      utils.localAuth.me.invalidate();
      utils.workflow.list.invalidate();
    });
  }, [firebaseMode, utils]);

  const { useServer, localFallbackAllowed, requiresSignIn } = resolveWorkflowSource({
    firebaseMode,
    isAuthenticated,
    remoteFailed: remote.isError,
    remoteLoaded: remote.data !== undefined,
  });

  const createRemote = trpc.workflow.create.useMutation();
  const saveDraftRemote = trpc.workflow.saveDraft.useMutation();
  const signRemote = trpc.workflow.sign.useMutation();
  const skipRemote = trpc.workflow.skip.useMutation();
  const reminderRemote = trpc.workflow.reminder.useMutation();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) {
          setLocalDocuments([sampleDocument()]);
          return;
        }
        const parsed = JSON.parse(stored) as WorkflowDocument[];
        setLocalDocuments(parsed.map((document) => ({ ...document, version: document.version ?? 1 })));
      })
      .catch(() => setLocalDocuments([sampleDocument()]))
      .finally(() => setLocalReady(true));
  }, []);

  useEffect(() => {
    if (localReady) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(localDocuments)).catch(() => undefined);
  }, [localDocuments, localReady]);

  const documents = useServer ? (remote.data ?? []) : localFallbackAllowed ? localDocuments : [];
  const isReady = useServer ? !remote.isLoading : localFallbackAllowed ? localReady : !session.isLoading;

  const getDocument = useCallback((id: string) => documents.find((document) => document.id === id), [documents]);

  const refresh = useCallback(async () => (useServer ? remote.refetch() : undefined), [useServer, remote]);

  const requireServer = useCallback(() => {
    if (!useServer && !localFallbackAllowed) {
      throw new Error("Entre com sua conta para trabalhar na versão compartilhada deste processo.");
    }
  }, [useServer, localFallbackAllowed]);

  const createWorkflow = useCallback(async (input: CreateWorkflowInput) => {
    requireServer();
    if (useServer) {
      const created = await createRemote.mutateAsync(input);
      await remote.refetch();
      return created.id;
    }
    const id = Crypto.randomUUID();
    const now = isoNow();
    const document: WorkflowDocument = {
      id,
      ...input,
      status: "in_progress",
      createdAt: now,
      updatedAt: now,
      source: "PM-COM-002",
      certificationState: "evidence_pending_qualification",
      version: 1,
      stages: createStages(),
      events: [makeEvent("Cap. Marina Souto", "created", "Processo criado e primeira etapa liberada para preenchimento.")],
    };
    setLocalDocuments((current) => [document, ...current]);
    return id;
  }, [useServer, createRemote, remote, requireServer]);

  const updateStage = useCallback(async (documentId: string, stageId: string, fields: Record<string, string | boolean>) => {
    requireServer();
    if (useServer) {
      await saveDraftRemote.mutateAsync({ processId: documentId, stageId, fields });
      await remote.refetch();
      return;
    }
    setLocalDocuments((current) => current.map((document) => {
      if (document.id !== documentId) return document;
      const target = document.stages.find((stage) => stage.id === stageId);
      if (!target || !canEditStage(target)) return document;
      const stages = document.stages.map((stage) => stage.id === stageId ? { ...stage, fields: { ...stage.fields, ...fields } } : stage);
      return {
        ...document,
        stages,
        version: document.version + 1,
        updatedAt: isoNow(),
        events: [...document.events, makeEvent(target.signerName, "saved", `Rascunho salvo em “${target.title}”.`)],
      };
    }));
  }, [useServer, saveDraftRemote, remote, requireServer]);

  const signActiveStage = useCallback(async (documentId: string, stageId: string, fields?: Record<string, string | boolean>) => {
    requireServer();
    if (useServer) {
      await signRemote.mutateAsync({ processId: documentId, stageId, fields });
      await remote.refetch();
      return;
    }
    const document = localDocuments.find((item) => item.id === documentId);
    const existingStage = document?.stages.find((item) => item.id === stageId);
    const stage = existingStage && { ...existingStage, fields: { ...existingStage.fields, ...fields } };
    if (!document || !stage || !canEditStage(stage)) throw new Error("Esta etapa não está disponível para assinatura.");
    if (stage.fields.consentimento !== true) throw new Error("A manifestação de vontade deve ser confirmada antes da assinatura.");

    const integrityHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      canonicalStagePayload(document, stage),
    );
    const signedAt = isoNow();

    setLocalDocuments((current) => current.map((item) => {
      if (item.id !== documentId) return item;
      const updatedStages = nextStatuses(item.stages, stageId).map((currentStage) => currentStage.id === stageId
        ? { ...currentStage, fields: stage.fields, status: "signed" as const, signedAt, integrityHash }
        : currentStage,
      );
      const next = getNextPendingStage(updatedStages, stageId);
      const complete = isWorkflowComplete(updatedStages);
      const events = [
        ...item.events,
        makeEvent(stage.signerName, "signed", `Etapa “${stage.title}” confirmada, registrada e bloqueada.`, integrityHash),
        ...(next ? [makeEvent("Sistema", "forwarded", `Etapa “${next.title}” liberada para ${next.signerName}.`)] : []),
      ];
      return { ...item, stages: updatedStages, status: complete ? "completed" : "in_progress", version: item.version + 1, updatedAt: signedAt, events };
    }));
  }, [useServer, signRemote, remote, localDocuments, requireServer]);

  const skipActiveStage = useCallback(async (documentId: string, stageId: string) => {
    requireServer();
    if (useServer) {
      await skipRemote.mutateAsync({ processId: documentId, stageId });
      await remote.refetch();
      return;
    }
    setLocalDocuments((current) => current.map((document) => {
      if (document.id !== documentId) return document;
      const stage = document.stages.find((item) => item.id === stageId);
      if (!stage || !stage.optional || !canEditStage(stage)) return document;
      const stages = nextStatuses(document.stages, stageId).map((item) => item.id === stageId ? { ...item, status: "skipped" as const } : item);
      const next = getNextPendingStage(stages, stageId);
      return {
        ...document,
        stages,
        version: document.version + 1,
        updatedAt: isoNow(),
        events: [
          ...document.events,
          makeEvent(stage.signerName, "skipped", `Etapa opcional “${stage.title}” marcada como não aplicável.`),
          ...(next ? [makeEvent("Sistema", "forwarded", `Etapa “${next.title}” liberada para ${next.signerName}.`)] : []),
        ],
      };
    }));
  }, [useServer, skipRemote, remote, requireServer]);

  const sendReminder = useCallback(async (documentId: string) => {
    if (useServer) {
      await reminderRemote.mutateAsync({ processId: documentId });
      await remote.refetch();
      return;
    }
    setLocalDocuments((current) => current.map((document) => {
      if (document.id !== documentId) return document;
      const active = document.stages.find((stage) => stage.status === "active");
      if (!active) return document;
      return {
        ...document,
        version: document.version + 1,
        updatedAt: isoNow(),
        events: [...document.events, makeEvent("Cap. Marina Souto", "reminder", `Aviso de pendência preparado para ${active.signerName}.`)],
      };
    }));
  }, [useServer, reminderRemote, remote]);

  const value = useMemo(() => ({
    documents,
    isReady,
    source: (useServer ? "server" : "local") as WorkflowSource,
    isLocalFallback: !useServer,
    requiresSignIn,
    getDocument,
    createWorkflow,
    updateStage,
    signActiveStage,
    skipActiveStage,
    sendReminder,
    refresh,
  }), [documents, isReady, useServer, localFallbackAllowed, requiresSignIn, getDocument, createWorkflow, updateStage, signActiveStage, skipActiveStage, sendReminder, refresh]);

  return <WorkflowContext.Provider value={value}>{children}</WorkflowContext.Provider>;
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) throw new Error("useWorkflow must be used inside WorkflowProvider");
  return context;
}
