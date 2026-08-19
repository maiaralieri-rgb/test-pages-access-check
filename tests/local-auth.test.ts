import { describe, expect, it } from "vitest";

import { createOpaqueToken, createPasswordHash, hashOpaqueToken, isStrongPassword, verifyPassword } from "../server/auth/local-auth";

describe("autenticação local do AssinaFluxo", () => {
  it("valida a senha particular sem armazenar o valor original", () => {
    const password = "AssinaFluxo2026";
    const stored = createPasswordHash(password);
    expect(stored.hash).not.toBe(password);
    expect(verifyPassword(password, stored.salt, stored.hash)).toBe(true);
    expect(verifyPassword("SenhaIncorreta2026", stored.salt, stored.hash)).toBe(false);
  });

  it("exige complexidade mínima para senha particular", () => {
    expect(isStrongPassword("curta1A")).toBe(false);
    expect(isStrongPassword("AssinaFluxo2026")).toBe(true);
  });

  it("produz tokens de sessão aleatórios e hashes não reversíveis", () => {
    const first = createOpaqueToken();
    const second = createOpaqueToken();
    expect(first).not.toBe(second);
    expect(hashOpaqueToken(first)).toHaveLength(64);
    expect(hashOpaqueToken(first)).not.toBe(first);
  });
});
