import { AccessToken } from "livekit-server-sdk";

// The Worker is a token-vending machine. It NEVER receives, stores, or proxies
// BYOK provider keys, and it holds no database. Its only job is to sign a
// short-lived LiveKit JWT using server-side secrets.

interface Env {
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_URL: string;
  ALLOWED_ORIGIN: string;
}

interface TokenRequest {
  roomName: string;
  identity: string;
}

const TOKEN_TTL = "15m";

// Allow any localhost / 127.0.0.1 origin (any port) for local dev, plus the
// configured ALLOWED_ORIGIN (comma-separated list supported for prod). Reflect
// the caller's Origin when allowed so the ACAO header matches exactly.
function resolveOrigin(request: Request, env: Env): string {
  const reqOrigin = request.headers.get("Origin") ?? "";
  const allowlist = (env.ALLOWED_ORIGIN ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin);
  if (reqOrigin && (allowlist.includes(reqOrigin) || isLocalhost)) return reqOrigin;
  return allowlist[0] ?? "*";
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = resolveOrigin(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/api/token") {
      if (request.method !== "POST") {
        return json({ error: "method not allowed" }, 405, origin);
      }

      let body: TokenRequest;
      try {
        body = (await request.json()) as TokenRequest;
      } catch {
        return json({ error: "invalid JSON body" }, 400, origin);
      }

      const { roomName, identity } = body ?? {};
      if (!roomName || !identity) {
        return json({ error: "roomName and identity are required" }, 400, origin);
      }

      const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
        identity,
        ttl: TOKEN_TTL,
      });
      at.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();
      return json({ token, url: env.LIVEKIT_URL }, 200, origin);
    }

    return json({ error: "not found" }, 404, origin);
  },
};
