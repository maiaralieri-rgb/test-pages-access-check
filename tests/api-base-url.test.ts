import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "../lib/api-base-url";

describe("endereço da API usado pelo cliente web", () => {
  it("respeita o override explícito e remove a barra final", () => {
    expect(resolveApiBaseUrl({ override: "https://api.exemplo.gov.br/" })).toBe("https://api.exemplo.gov.br");
  });

  it("aponta para o subdomínio irmão no ambiente hospedado", () => {
    expect(resolveApiBaseUrl({ protocol: "https:", hostname: "8081-abc.regiao.host", port: "" }))
      .toBe("https://3000-abc.regiao.host");
  });

  it("troca a porta na execução local", () => {
    // Regressão: antes devolvia string vazia, então o cliente pedia a API ao
    // próprio servidor web e recebia HTML no lugar de JSON.
    expect(resolveApiBaseUrl({ protocol: "http:", hostname: "localhost", port: "8081" }))
      .toBe("http://localhost:3000");
    expect(resolveApiBaseUrl({ protocol: "http:", hostname: "127.0.0.1", port: "8081" }))
      .toBe("http://127.0.0.1:3000");
  });

  it("aceita portas personalizadas", () => {
    expect(resolveApiBaseUrl({ protocol: "http:", hostname: "localhost", port: "19006", webPort: "19006", apiPort: "4000" }))
      .toBe("http://localhost:4000");
  });

  it("usa a mesma origem quando a API é servida pelo próprio host", () => {
    expect(resolveApiBaseUrl({ protocol: "https:", hostname: "lmp.pmesp.gov.br", port: "" })).toBe("");
    expect(resolveApiBaseUrl({ protocol: "https:", hostname: "lmp.pmesp.gov.br", port: "443" })).toBe("");
  });
});
