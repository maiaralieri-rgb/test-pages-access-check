import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerPdfExportRoute } from "./pdf-export";
import { describeWorkflowStorage } from "./workflow";
import { getIdentityProvider } from "./identity";

/**
 * Builds the API without binding a port, so the same application runs as a
 * standalone Node server locally and as a single Cloud Function behind Firebase
 * Hosting in production.
 */
export function createApp(): Express {
  const app = express();

  // Reflect the request origin so credentialed cross-origin calls work during
  // local development. Behind Firebase Hosting the client and the API share an
  // origin and this never triggers.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerPdfExportRoute(app);

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      storage: describeWorkflowStorage(),
      identity: getIdentityProvider().id,
      timestamp: Date.now(),
    });
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  return app;
}
