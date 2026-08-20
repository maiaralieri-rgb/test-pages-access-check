import type { IncomingMessage, ServerResponse } from "node:http";

import { createApp } from "../server/app";

/**
 * The whole API as a single serverless function.
 *
 * The same Express application runs here, on Cloud Functions and on the local
 * server — only the wrapper changes. Keeping one application means the workflow
 * rules, the transactional signature and the authorisation checks are identical
 * in every deployment.
 */
const app = createApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Depending on how the route matched, the platform may hand us the path with
  // the /api prefix already stripped. Express registers its routes with the
  // prefix, so restore it when needed.
  if (req.url && !req.url.startsWith("/api")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return (app as unknown as (request: IncomingMessage, response: ServerResponse) => void)(req, res);
}
