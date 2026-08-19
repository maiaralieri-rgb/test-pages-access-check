import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

import { createApp } from "./app";

setGlobalOptions({ region: "southamerica-east1", maxInstances: 10 });

/**
 * The whole API as a single function. Firebase Hosting rewrites `/api/**` here,
 * so the browser talks to one origin and the session travels as a Firebase ID
 * token — no cross-site cookie involved.
 */
export const api = onRequest({ cors: false }, createApp());
