/**
 * Resolves where the web client should reach the API.
 *
 * Three deployments have to work:
 *  - explicit override (EXPO_PUBLIC_API_BASE_URL) wins everywhere;
 *  - hosted sandbox, where client and API sit on sibling subdomains
 *    (`8081-xxx.host` / `3000-xxx.host`);
 *  - local run, where both are on the same host and only the port differs.
 *
 * The local case used to fall through to a relative URL, which made the client
 * request the API from the static/Metro server and receive HTML instead of JSON.
 */
export function resolveApiBaseUrl(input: {
  override?: string;
  protocol?: string;
  hostname?: string;
  port?: string;
  webPort?: string;
  apiPort?: string;
}): string {
  const { override, protocol, hostname, port } = input;
  const webPort = input.webPort ?? "8081";
  const apiPort = input.apiPort ?? "3000";

  if (override) return override.replace(/\/$/, "");
  if (!protocol || !hostname) return "";

  const siblingHost = hostname.replace(new RegExp(`^${webPort}-`), `${apiPort}-`);
  if (siblingHost !== hostname) return `${protocol}//${siblingHost}`;

  if (port && port === webPort) return `${protocol}//${hostname}:${apiPort}`;

  // Same origin: a single-port deployment serves the API itself.
  return "";
}
