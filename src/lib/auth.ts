import type { AuthInfo } from "@modelcontextprotocol/server";
import { adminApiKey, agentApiKey } from "./env";

export type ActorRole = "agent" | "human" | "system";
export type AuthVia = "agent-api" | "admin" | "mcp" | "system";

export interface Actor {
  actor: ActorRole;
  via: AuthVia;
}

/** Cookie the review UI uses so the admin key never travels in a URL. */
export const ADMIN_SESSION_COOKIE = "woklaa_admin_session";
/** Review sessions are short-lived on purpose. */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

/** Constant-time string compare — avoids leaking the key via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a candidate admin key without leaking it through timing. */
export function isAdminKey(candidate: string | null | undefined): boolean {
  const expected = adminApiKey();
  if (!expected || !candidate) return false;
  return safeEqual(candidate, expected);
}

function getBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function agentToken(): string | undefined {
  return agentApiKey();
}

export function adminToken(): string | undefined {
  return adminApiKey();
}

/**
 * Authenticate a content request from the external agent (direct REST calls)
 * or from a privileged human. Accepts `Authorization: Bearer <AGENT_API_KEY>`
 * or the admin key via header. Never reads the key from the query string.
 */
export function authenticateAgent(req: Request): Actor | null {
  const bearer = getBearer(req);
  const expected = agentToken();
  if (expected && bearer && safeEqual(bearer, expected)) {
    return { actor: "agent", via: "agent-api" };
  }
  return authenticateAdmin(req);
}

/**
 * Authenticate a human reviewer (admin key only). Headers and the review
 * session cookie are accepted; the query string is never consulted.
 */
export function authenticateAdmin(req: Request): Actor | null {
  const expected = adminToken();
  if (!expected) return null;
  const header = req.headers.get("x-admin-key");
  if (header && safeEqual(header, expected)) return { actor: "human", via: "admin" };
  const bearer = getBearer(req);
  if (bearer && safeEqual(bearer, expected)) return { actor: "human", via: "admin" };
  const session = getCookie(req, ADMIN_SESSION_COOKIE);
  if (session && safeEqual(session, expected)) return { actor: "human", via: "admin" };
  return null;
}

/**
 * Verify an MCP request's bearer token and return the pass-through `AuthInfo`
 * the SDK hands to tool handlers. Returns `undefined` when unauthorized.
 */
export function mcpAuthInfo(req: Request): AuthInfo | undefined {
  const expected = agentToken();
  const bearer = getBearer(req);
  if (!expected || !bearer || !safeEqual(bearer, expected)) return undefined;
  return {
    token: "verified",
    clientId: "agent",
    scopes: ["content:write"],
  };
}
