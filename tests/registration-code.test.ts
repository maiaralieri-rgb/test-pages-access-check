import { afterEach, describe, expect, it } from "vitest";

import { validateRegistrationCode } from "../server/auth/local-auth";

const original = process.env.ASSINAFLUXO_REGISTRATION_CODE;

afterEach(() => {
  if (original === undefined) delete process.env.ASSINAFLUXO_REGISTRATION_CODE;
  else process.env.ASSINAFLUXO_REGISTRATION_CODE = original;
});

describe("código de cadastro por convite", () => {
  it("aceita somente o segredo configurado no servidor", () => {
    process.env.ASSINAFLUXO_REGISTRATION_CODE = "segredo-de-teste-nao-usar-em-producao";

    expect(validateRegistrationCode("segredo-de-teste-nao-usar-em-producao")).toBe(true);
    expect(validateRegistrationCode("segredo-de-teste-nao-usar-em-producao-incorreto")).toBe(false);
    expect(validateRegistrationCode("")).toBe(false);
  });

  it("recusa qualquer cadastro quando o segredo não está configurado", () => {
    delete process.env.ASSINAFLUXO_REGISTRATION_CODE;

    // Fails closed: without the server secret no registration may proceed.
    expect(validateRegistrationCode("qualquer-valor")).toBe(false);
    expect(validateRegistrationCode("")).toBe(false);
  });
});
