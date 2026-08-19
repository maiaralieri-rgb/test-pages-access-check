import type { Request } from "express";
import { describe, expect, it } from "vitest";

import { getSessionCookieOptions } from "../server/_core/cookies";

const request = (hostname: string, protocol: "http" | "https", forwarded?: string) =>
  ({ hostname, protocol, headers: forwarded ? { "x-forwarded-proto": forwarded } : {} }) as unknown as Request;

describe("cookie de sessão", () => {
  it("nunca combina SameSite=None com conexão insegura", () => {
    // Regressão: navegadores descartam SameSite=None sem Secure, então o login
    // nunca se mantinha em execuções locais por HTTP.
    const options = getSessionCookieOptions(request("localhost", "http"));

    expect(options.secure).toBe(false);
    expect(options.sameSite).toBe("lax");
    expect(options.httpOnly).toBe(true);
    expect(options.domain).toBeUndefined();
  });

  it("usa SameSite=None sob HTTPS para permitir subdomínios distintos", () => {
    const options = getSessionCookieOptions(request("3000-abc.regiao.host", "https"));

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
    expect(options.domain).toBe(".regiao.host");
  });

  it("reconhece HTTPS informado pelo proxy reverso", () => {
    const options = getSessionCookieOptions(request("lmp.pmesp.gov.br", "http", "https"));

    expect(options.secure).toBe(true);
    expect(options.sameSite).toBe("none");
  });

  it("não define domínio para endereços IP", () => {
    expect(getSessionCookieOptions(request("192.168.0.10", "http")).domain).toBeUndefined();
  });
});
