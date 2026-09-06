import type { AppEnv, AuthUser, Session } from "./types";

const encoder = new TextEncoder();
const COOKIE = "ceniza_session";

const bytesToBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const randomToken = (length = 32): string => bytesToBase64(crypto.getRandomValues(new Uint8Array(length))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function sha256(value: string): Promise<string> {
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function cookieValue(request: Request): string | null {
  const match = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match?.[1] ?? null;
}

export async function createSession(request: Request, env: AppEnv, userId: string): Promise<{ cookie: string; csrfToken: string }> {
  const token = randomToken();
  const csrfToken = randomToken(24);
  const idHash = await sha256(token);
  const ttl = Number(env.SESSION_TTL_SECONDS) || 604800;
  const expires = new Date(Date.now() + ttl * 1000);
  const ip = request.headers.get("CF-Connecting-IP")?.split(".").slice(0, 3).join(".") ?? null;
  await env.DB.prepare("INSERT INTO sessions(id_hash,user_id,csrf_token,expires_at,user_agent,ip_prefix) VALUES(?,?,?,?,?,?)")
    .bind(idHash, userId, csrfToken, expires.toISOString(), request.headers.get("User-Agent")?.slice(0, 255) ?? null, ip).run();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return { cookie: `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure}`, csrfToken };
}

export async function readSession(request: Request, env: AppEnv): Promise<Session | null> {
  const token = cookieValue(request);
  if (!token) return null;
  const idHash = await sha256(token);
  const row = await env.DB.prepare("SELECT u.id,u.email,u.display_name,u.role,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>CURRENT_TIMESTAMP AND u.disabled=0")
    .bind(idHash).first<{ id: string; email: string; display_name: string; role: AuthUser["role"]; csrf_token: string }>();
  if (!row) return null;
  return { sessionHash: idHash, csrfToken: row.csrf_token, user: { id: row.id, email: row.email, displayName: row.display_name, role: row.role } };
}

export async function destroySession(request: Request, env: AppEnv): Promise<string> {
  const token = cookieValue(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE id_hash=?").bind(await sha256(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function validCsrf(request: Request, session: Session): boolean {
  const token = request.headers.get("X-CSRF-Token");
  return Boolean(token && constantTimeEqual(encoder.encode(token), encoder.encode(session.csrfToken)));
}

export async function checkLoginLimit(env: AppEnv, key: string): Promise<boolean> {
  const now = Date.now();
  const row = await env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM login_attempts WHERE key=?").bind(key).first<{ attempts: number; window_started_at: number; blocked_until: number }>();
  return !row || row.blocked_until <= now;
}

export async function recordLogin(env: AppEnv, key: string, success: boolean): Promise<void> {
  if (success) { await env.DB.prepare("DELETE FROM login_attempts WHERE key=?").bind(key).run(); return; }
  const now = Date.now();
  const row = await env.DB.prepare("SELECT attempts,window_started_at FROM login_attempts WHERE key=?").bind(key).first<{ attempts: number; window_started_at: number }>();
  const reset = !row || now - row.window_started_at > 15 * 60_000;
  const attempts = reset ? 1 : row.attempts + 1;
  const blocked = attempts >= 6 ? now + Math.min(30 * 60_000, 30_000 * 2 ** (attempts - 6)) : 0;
  await env.DB.prepare("INSERT INTO login_attempts(key,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until")
    .bind(key, attempts, reset ? now : row.window_started_at, blocked).run();
}
