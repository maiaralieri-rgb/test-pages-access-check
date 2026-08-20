#!/usr/bin/env node
/**
 * Builds the web client for Vercel.
 *
 * The public Firebase config (apiKey, authDomain, appId…) is needed at build
 * time. Instead of asking someone to copy six values by hand — and keep them in
 * sync — this reads them from the project itself using the service account that
 * is already configured for the API. If that is not possible, it falls back to
 * whatever EXPO_PUBLIC_FIREBASE_* variables are already set.
 */
import { spawnSync } from "node:child_process";

const REQUIRED = "EXPO_PUBLIC_FIREBASE_PROJECT_ID";

async function fetchWebConfig() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT não é um JSON válido. Cole o conteúdo completo do arquivo da chave.");
  }

  const { cert, initializeApp, getApps } = await import("firebase-admin/app");
  const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) });
  const token = await app.options.credential.getAccessToken();

  const projectId = credentials.project_id;
  const response = await fetch(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps/-/config`,
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Não foi possível ler a configuração do app web (${response.status}). ` +
        `Confirme que existe um app Web registrado no projeto ${projectId}. Detalhe: ${detail.slice(0, 200)}`,
    );
  }
  return response.json();
}

const env = { ...process.env };

if (!env[REQUIRED]) {
  const config = await fetchWebConfig();
  if (config) {
    env.EXPO_PUBLIC_FIREBASE_API_KEY = config.apiKey ?? "";
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = config.authDomain ?? "";
    env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = config.projectId ?? "";
    env.EXPO_PUBLIC_FIREBASE_APP_ID = config.appId ?? "";
    env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = config.storageBucket ?? "";
    env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = config.messagingSenderId ?? "";
    console.log(`[build] configuração lida do projeto ${config.projectId}`);
  }
}

if (!env[REQUIRED]) {
  console.error(
    "[build] Falta a configuração do Firebase.\n" +
      "        Defina FIREBASE_SERVICE_ACCOUNT (recomendado) ou as variáveis EXPO_PUBLIC_FIREBASE_*.",
  );
  process.exit(1);
}

// On Vercel one deployment answers both the pages and /api, so the client must
// use a relative URL instead of guessing a port.
env.EXPO_PUBLIC_API_SAME_ORIGIN = "true";

const result = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", "dist-web"], {
  stdio: "inherit",
  env,
});
process.exit(result.status ?? 1);
