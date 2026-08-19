import { createHash } from "node:crypto";

/**
 * Seam for the signature layer.
 *
 * The only implementation shipped today records local evidence: a SHA-256 over
 * the canonical payload plus the signer identity and the moment of consent.
 * That is evidence of integrity and intent — it is NOT an ICP-Brasil qualified
 * signature and does not carry a trusted timestamp. A certified provider must
 * be plugged in here after the applicable institutional accreditation; nothing
 * in this file should be read as claiming that accreditation exists.
 */
export type SignatureEvidence = {
  provider: string;
  integrityHash: string;
  /** Opaque reference returned by an external provider, when there is one. */
  providerReference?: string;
  qualified: boolean;
};

export type SignatureRequest = {
  canonicalPayload: string;
  processId: string;
  stageKey: string;
  signerAccountId: number;
  signerName: string;
  signerRegistrationId: string;
  signedAt: string;
};

export interface SignatureProvider {
  readonly id: string;
  readonly qualified: boolean;
  sign(request: SignatureRequest): Promise<SignatureEvidence>;
}

export const localEvidenceProvider: SignatureProvider = {
  id: "local-evidence",
  qualified: false,
  async sign(request) {
    const integrityHash = createHash("sha256").update(request.canonicalPayload, "utf8").digest("hex");
    return { provider: "local-evidence", integrityHash, qualified: false };
  },
};

let activeProvider: SignatureProvider = localEvidenceProvider;

export function getSignatureProvider() {
  return activeProvider;
}

/** Used by the eventual certified integration and by tests. */
export function setSignatureProvider(provider: SignatureProvider) {
  activeProvider = provider;
}
