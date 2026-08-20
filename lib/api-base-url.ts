/**
 * Resolves where the web client should reach the API.
 *
 * Four deployments have to work:
 *  - explicit override (EXPO_PUBLIC_API_BASE_URL) wins everywhere;
 *  - same origin, where one server answers both the pages and `/api` — Vercel,
 *    Firebase Hosting with a rewrite, or any single-domain hosting;
 *  - hosted sandbox, where client and API sit on sibling subdomains
 *    (`8081-xxx.host` / `3000-xxx.host`);
 *  - local development, where both are on the same host and only the port differs.
 *
 * Same origin has to be stated explicitly: an empty base URL is indistinguishable
 * from "not configured", and the local-development rule would otherwise send the
 * client to port 3000 on a deployment where nothing listens there.
 */
export function resolveApiBaseUrl(input: {
  override?: string;
  sameOrigin?: boolean;
  protocol?: string;
  hostname?: string;
  port?: string;
  webPort?: string;
  apiPort?: string;
}): string {
  const { override, sameOrigin, protocol, hostname, port } = input;
  const webPort = input.webPort ?? "8081";
  const apiPort = input.apiPort ?? "3000";

  if (override) return override.replace(/\/$/, "");
  if (sameOrigin) return "";
  if (!protocol || !hostname) return "";

  const siblingHost = hostname.replace(new RegExp(`^${webPort}-`), `${apiPort}-`);
  if (siblingHost !== hostname) return `${protocol}//${siblingHost}`;

  if (port && port === webPort) return `${protocol}//${hostname}:${apiPort}`;

  // Nothing else matched: assume the API answers on the current origin.
  return "";
}
