import "dotenv/config";
import { createServer } from "http";
import net from "net";

import { createApp } from "../app";
import { describeStore, isFileStoreActive } from "../store/local-store";
import { describeWorkflowStorage } from "../workflow";
import { getIdentityProvider } from "../identity";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.warn(`[api] porta ${preferredPort} ocupada; usando ${port}.`);
    console.warn(`[api] o cliente web procura a API na porta ${preferredPort}. Defina EXPO_PUBLIC_API_PORT=${port} ao iniciar a web, ou libere a porta ${preferredPort}.`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    console.log(`[api] persistência: ${describeWorkflowStorage()}`);
    console.log(`[api] identidade: ${getIdentityProvider().id === "firebase" ? "Firebase Auth" : "contas locais"}`);
    if (describeWorkflowStorage() === "arquivo local") {
      console.log(`[api] ${describeStore()}`);
      if (isFileStoreActive()) {
        console.log("[api] modo processo único: os signatários compartilham o documento por este servidor. Configure Firebase ou DATABASE_URL para produção.");
      }
    }
    if (!process.env.ASSINAFLUXO_REGISTRATION_CODE) {
      console.warn("[api] ASSINAFLUXO_REGISTRATION_CODE não configurado: nenhum cadastro será aceito. Rode `pnpm env:setup` para gerar um.");
    }
  });
}

startServer().catch(console.error);
