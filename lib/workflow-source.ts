export type WorkflowSourceState = {
  /** Reads and writes go to the shared server document. */
  useServer: boolean;
  /** The browser-only copy may be used. Never true when Firebase is configured. */
  localFallbackAllowed: boolean;
  /** Firebase is configured but there is no usable session yet. */
  requiresSignIn: boolean;
};

/**
 * Decides where the planilha is read from and written to.
 *
 * The dangerous case this guards against: Firebase configured, session not yet
 * restored, the first API call comes back unauthorised — and the app quietly
 * serves the browser-only copy. A signature recorded there looks successful on
 * screen and reaches nobody. When Firebase is configured there is therefore no
 * local fallback at all; the user is asked to sign in instead.
 */
export function resolveWorkflowSource(input: {
  firebaseMode: boolean;
  isAuthenticated: boolean;
  remoteFailed: boolean;
  remoteLoaded: boolean;
}): WorkflowSourceState {
  const useServer = input.isAuthenticated && !input.remoteFailed && input.remoteLoaded;
  const localFallbackAllowed = !input.firebaseMode;
  return {
    useServer,
    localFallbackAllowed,
    requiresSignIn: !useServer && !localFallbackAllowed,
  };
}
