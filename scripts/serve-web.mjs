#!/usr/bin/env node
/**
 * Serves the exported web build with SPA fallback, using the express dependency
 * the project already has. Pairs with `pnpm dev:server` for a run that does not
 * depend on the Metro dev server.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import express from "express";

const DIR = resolve(process.env.WEB_DIR ?? "dist-web");
const PORT = Number(process.env.WEB_PORT ?? 8081);

if (!existsSync(DIR)) {
  console.error(`[web] build não encontrado em ${DIR}. Rode "pnpm build:web" antes.`);
  process.exit(1);
}

const app = express();
app.use(express.static(DIR, { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(resolve(DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`[web] interface em http://localhost:${PORT}`);
  console.log(`[web] a API é procurada em http://localhost:${process.env.EXPO_PUBLIC_API_PORT ?? 3000}`);
});
