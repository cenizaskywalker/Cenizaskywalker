import { Hono } from "hono";
import { z } from "zod";
import admin from "./admin";
import { getPublicContent } from "./content";
import { PasswordHasher } from "./password-hasher";
import { PublicationHub } from "./publication-hub";
import { readSession, validCsrf } from "./security";
import type { AppEnv, AppVariables } from "./types";

export { PasswordHasher, PublicationHub };
const app = new Hono<{ Bindings: AppEnv; Variables: AppVariables }>();
const COMMISSION_REQUEST_LIMIT = 10;
const COMMISSION_REQUEST_WINDOW_MS = 60 * 60_000;

interface CommissionNotification {
  id: string;
  projectType: string;
  budget: string;
  description: string;
  deadline: string;
  discordUsername: string;
  email: string;
  priorityRequested: boolean;
}

async function notifyDiscord(webhookUrl: string, request: CommissionNotification): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "@everyone New commission request",
        allowed_mentions: { parse: ["everyone"] },
        username: "Ceniza Commissions",
        embeds: [{
          title: "New UI commission",
          description: request.description,
          color: 0x8fffa7,
          fields: [
            { name: "Project type", value: request.projectType, inline: true },
            { name: "Budget", value: request.budget, inline: true },
            { name: "Deadline", value: request.deadline, inline: true },
            { name: "Email · preferred", value: request.email, inline: true },
            { name: "Discord · backup", value: request.discordUsername, inline: true },
            { name: "Priority delivery", value: request.priorityRequested ? "Requested" : "Standard", inline: true },
          ],
          footer: { text: `Request ID · ${request.id}` },
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ level: "error", message: "Discord notification failed", status: response.status, requestId: request.id }));
    }
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: "Discord notification unavailable", requestId: request.id, error: error instanceof Error ? error.message : "Unknown error" }));
  }
}

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff"); c.header("X-Frame-Options", "DENY"); c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
});

app.get("/api/content", async (c) => c.json(await getPublicContent(c.env), 200, { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" }));
app.post("/api/commission-requests", async (c) => {
  const schema = z.object({
    projectType: z.string().min(3).max(100),
    budget: z.string().min(1).max(80),
    description: z.string().min(30).max(4000),
    deadline: z.string().min(2).max(100),
    discordUsername: z.string().min(2).max(80),
    email: z.string().email().max(254),
    priorityRequested: z.boolean().optional().default(false),
    website: z.string().max(0).optional().default(""),
  });
  const body = schema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Please complete every required field with valid information" }, 400);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`commission:${ip}`));
  const key = btoa(String.fromCharCode(...new Uint8Array(keyBytes)));
  const now = Date.now();
  const limit = await c.env.DB.prepare("SELECT attempts,window_started_at FROM commission_request_limits WHERE key=?").bind(key).first<{ attempts: number; window_started_at: number }>();
  const expired = !limit || now - limit.window_started_at > COMMISSION_REQUEST_WINDOW_MS;
  if (limit && !expired && limit.attempts >= COMMISSION_REQUEST_LIMIT) {
    return c.json({ error: "You reached the limit of 10 commission requests per hour. Please try again later." }, 429);
  }
  await c.env.DB.prepare("INSERT INTO commission_request_limits(key,attempts,window_started_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at")
    .bind(key, expired ? 1 : (limit?.attempts ?? 0) + 1, expired ? now : limit?.window_started_at ?? now).run();
  const requestId = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO commission_requests(id,project_type,budget,description,deadline,discord_username,email,priority_requested) VALUES(?,?,?,?,?,?,?,?)")
    .bind(requestId, body.data.projectType, body.data.budget, body.data.description, body.data.deadline, body.data.discordUsername, body.data.email, body.data.priorityRequested ? 1 : 0).run();
  if (c.env.DISCORD_WEBHOOK_URL) {
    c.executionCtx.waitUntil(notifyDiscord(c.env.DISCORD_WEBHOOK_URL, { id: requestId, ...body.data }));
  }
  return c.json({ id: requestId, message: "Request received. Ceniza will contact you by email (preferred) or Discord." }, 201);
});
app.get("/api/projects/:slug", async (c) => {
  const project = await c.env.DB.prepare("SELECT * FROM projects WHERE slug=? AND published=1").bind(c.req.param("slug")).first<Record<string, unknown>>();
  if (!project) return c.json({ error: "Project not found" }, 404);
  const images = await c.env.DB.prepare("SELECT * FROM project_images WHERE project_id=? ORDER BY display_order").bind(project.id).all();
  return c.json({ ...project, tags: JSON.parse(String(project.tags)), images: images.results });
});
app.get("/media/:id", async (c) => {
  const media = await c.env.DB.prepare("SELECT storage_key,mime_type FROM media WHERE id=?").bind(c.req.param("id")).first<{ storage_key: string; mime_type: string }>();
  if (!media) return c.notFound();
  const object = await c.env.MEDIA.get(media.storage_key);
  if (!object) return c.notFound();
  return new Response(object.body, { headers: { "Content-Type": media.mime_type, "Cache-Control": "public,max-age=31536000,immutable", ETag: object.httpEtag } });
});
app.get("/realtime", (c) => c.env.PUBLICATIONS.getByName("portfolio").fetch(c.req.raw));

app.use("/api/admin/*", async (c, next) => {
  if (["/api/admin/login","/api/admin/setup","/api/admin/setup-status"].includes(c.req.path)) return next();
  const session = await readSession(c.req.raw, c.env);
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("session", session);
  if (!["GET","HEAD","OPTIONS"].includes(c.req.method) && !validCsrf(c.req.raw, session)) return c.json({ error: "Invalid CSRF token" }, 403);
  return next();
});
app.route("/api/admin", admin);

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;
