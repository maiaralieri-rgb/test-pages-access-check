#!/usr/bin/env node
/**
 * Prepares a runnable environment without asking the operator to invent secrets.
 * Creates .env if it is missing and fills ASSINAFLUXO_REGISTRATION_CODE and
 * JWT_SECRET with random values. Existing values are never overwritten, and the
 * file is not versioned.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env";
const secret = (bytes) => randomBytes(bytes).toString("base64url");

const current = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
const lines = current.split("\n");

function valueOf(key) {
  const line = lines.find((item) => item.startsWith(`${key}=`));
  const value = line?.slice(key.length + 1).trim();
  return value ? value : undefined;
}

function upsert(key, value) {
  const index = lines.findIndex((item) => item.startsWith(`${key}=`));
  if (index >= 0) lines[index] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
}

const created = [];

if (!valueOf("ASSINAFLUXO_REGISTRATION_CODE")) {
  const code = secret(12);
  upsert("ASSINAFLUXO_REGISTRATION_CODE", code);
  created.push(["ASSINAFLUXO_REGISTRATION_CODE", code]);
}

if (!valueOf("JWT_SECRET")) {
  upsert("JWT_SECRET", secret(32));
  created.push(["JWT_SECRET", "(gerado)"]);
}

if (!lines.some((item) => item.startsWith("DATABASE_URL="))) {
  upsert("DATABASE_URL", "");
}

const output = lines.filter((line, index) => line !== "" || index < lines.length - 1).join("\n").replace(/\n+$/, "") + "\n";
writeFileSync(ENV_FILE, output, "utf8");

if (created.length === 0) {
  console.log("[setup] .env já estava configurado; nada foi alterado.");
} else {
  console.log("[setup] .env preparado.");
  for (const [key, value] of created) console.log(`[setup]   ${key} = ${value}`);
}

console.log("");
console.log("[setup] O código de cadastro acima é exigido de quem for criar conta.");
console.log("[setup] Guarde-o e compartilhe apenas com quem deve entrar no sistema.");
if (!valueOf("DATABASE_URL")) {
  console.log("[setup] DATABASE_URL vazio: o app roda com armazenamento local em .data/assinafluxo.json.");
}
