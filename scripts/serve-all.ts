/**
 * Serves the built web client and the API on a single port, which is how the
 * application runs on Vercel (and on any self-hosted setup behind one domain).
 *
 * Same-origin means the client resolves the API with a relative URL, so there is
 * no port mapping and no cross-origin request involved.
 */
import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import express from "express";

import { createApp } from "../server/app";

const DIR = resolve(process.env.WEB_DIR ?? "dist-web");
const PORT = Number(process.env.PORT ?? 8081);

if (!existsSync(DIR)) {
  console.error(`[app] build não encontrado em ${DIR}. Rode "pnpm build:web" antes.`);
  process.exit(1);
}

const app = express();
app.use(createApp());
app.use(express.static(DIR, { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(resolve(DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`[app] interface e API em http://localhost:${PORT}`);
});
