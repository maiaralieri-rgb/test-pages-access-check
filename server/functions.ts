import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

import { createApp } from "./app";

setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

/**
 * Declared so Cloud Functions injects it at runtime. The value lives in Secret
 * Manager and never appears in the repository or in the deploy logs.
 */
const registrationCode = defineSecret("ASSINAFLUXO_REGISTRATION_CODE");

/**
 * The whole API as a single function. Firebase Hosting rewrites `/api/**` here,
 * so the browser talks to one origin and the session travels as a Firebase ID
 * token — no cross-site cookie involved.
 */
export const api = onRequest({ cors: false, secrets: [registrationCode] }, createApp());
