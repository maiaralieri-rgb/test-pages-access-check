import { describe, expect, it } from "vitest";

import { resolveWorkflowSource } from "../lib/workflow-source";

describe("origem do documento", () => {
  it("usa o servidor quando a sessão é válida e a API respondeu", () => {
    const state = resolveWorkflowSource({ firebaseMode: true, isAuthenticated: true, remoteFailed: false, remoteLoaded: true });

    expect(state.useServer).toBe(true);
    expect(state.requiresSignIn).toBe(false);
  });

  it("nunca oferece cópia local quando o Firebase está configurado", () => {
    // Regressão: enquanto o Firebase restaura a sessão, a primeira chamada volta
    // sem autorização. Se o app caísse no modo local aqui, uma assinatura
    // pareceria concluída na tela e não chegaria a ninguém.
    const restoring = resolveWorkflowSource({ firebaseMode: true, isAuthenticated: false, remoteFailed: false, remoteLoaded: false });

    expect(restoring.useServer).toBe(false);
    expect(restoring.localFallbackAllowed).toBe(false);
    expect(restoring.requiresSignIn).toBe(true);
  });

  it("também recusa a cópia local quando a API falha em modo Firebase", () => {
    const failed = resolveWorkflowSource({ firebaseMode: true, isAuthenticated: true, remoteFailed: true, remoteLoaded: false });

    expect(failed.useServer).toBe(false);
    expect(failed.localFallbackAllowed).toBe(false);
    expect(failed.requiresSignIn).toBe(true);
  });

  it("mantém o modo local como rede de proteção fora do Firebase", () => {
    const local = resolveWorkflowSource({ firebaseMode: false, isAuthenticated: false, remoteFailed: false, remoteLoaded: false });

    expect(local.useServer).toBe(false);
    expect(local.localFallbackAllowed).toBe(true);
    expect(local.requiresSignIn).toBe(false);
  });
});
