import { Hono } from "hono";
import { z } from "zod";
import {
  createSession,
  destroySession,
  hashPassword,
  recordLogin,
  checkLoginLimit,
  verifyPassword,
} from "./security";
import type { AppEnv, AppVariables, Role } from "./types";

type Bindings = { Bindings: AppEnv; Variables: AppVariables };
const admin = new Hono<Bindings>();
const roles: Record<Role, number> = { EDITOR: 1, ADMIN: 2, OWNER: 3 };
const id = (): string => crypto.randomUUID();
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  displayName: z.string().min(2).max(80).optional(),
});

const collections = {
  projects: {
    table: "projects",
    fields: [
      "slug",
      "title",
      "subtitle",
      "description",
      "design_goals",
      "year",
      "role",
      "category",
      "tags",
      "cover_media_id",
      "cover_url",
      "external_url",
      "roblox_url",
      "featured",
      "published",
      "display_order",
    ],
  },
  gallery: {
    table: "gallery_items",
    fields: [
      "title",
      "alt_text",
      "category",
      "media_id",
      "image_url",
      "project_id",
      "featured",
      "enabled",
      "display_order",
    ],
  },
  services: {
    table: "services",
    fields: ["title", "description", "enabled", "display_order"],
  },
  process: {
    table: "process_steps",
    fields: ["title", "description", "enabled", "display_order"],
  },
  pricing: {
    table: "pricing_items",
    fields: [
      "title",
      "description",
      "price_label",
      "features",
      "turnaround",
      "revisions",
      "featured",
      "enabled",
      "display_order",
    ],
  },
  socials: {
    table: "social_links",
    fields: [
      "platform",
      "label",
      "url",
      "copy_value",
      "enabled",
      "display_order",
    ],
  },
  stats: {
    table: "stats",
    fields: ["label", "value", "enabled", "display_order"],
  },
} as const;
type Collection = keyof typeof collections;

function cleanBody(
  input: unknown,
  fields: readonly string[],
): Record<string, string | number | null> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid body");
  const output: Record<string, string | number | null> = {};
  for (const field of fields) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined) continue;
    if ((field === "tags" || field === "features") && Array.isArray(value))
      output[field] = JSON.stringify(value.slice(0, 20).map(String));
    else if (typeof value === "string")
      output[field] = value.slice(
        0,
        field.includes("description") || field === "design_goals"
          ? 10_000
          : 500,
      );
    else if (typeof value === "number" && Number.isFinite(value))
      output[field] = value;
    else if (typeof value === "boolean") output[field] = value ? 1 : 0;
    else if (value === null) output[field] = null;
  }
  return output;
}

async function audit(
  env: AppEnv,
  userId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO audit_logs(id,user_id,action,target_type,target_id,metadata) VALUES(?,?,?,?,?,?)",
  )
    .bind(id(), userId, action, targetType, targetId, JSON.stringify(metadata))
    .run();
}

admin.get("/setup-status", async (c) => {
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) count FROM users",
  ).first<{ count: number }>();
  return c.json({ setupRequired: (count?.count ?? 0) === 0 });
});

admin.post("/setup", async (c) => {
  const parsed = credentials.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !parsed.data.displayName)
    return c.json(
      {
        error:
          "A valid name, email and password of at least 12 characters are required",
      },
      400,
    );
  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) count FROM users",
  ).first<{ count: number }>();
  if ((count?.count ?? 0) !== 0)
    return c.json({ error: "Initial setup is closed" }, 409);
  const password = await hashPassword(parsed.data.password);
  const userId = id();
  try {
    await c.env.DB.prepare(
      "INSERT INTO users(id,email,display_name,role,password_hash,password_salt,password_iterations) SELECT ?,?,?,'OWNER',?,?,? WHERE NOT EXISTS(SELECT 1 FROM users)",
    )
      .bind(
        userId,
        parsed.data.email,
        parsed.data.displayName,
        password.hash,
        password.salt,
        password.iterations,
      )
      .run();
  } catch {
    return c.json({ error: "Initial setup is already complete" }, 409);
  }
  const session = await createSession(c.req.raw, c.env, userId);
  return c.json({ csrfToken: session.csrfToken }, 201, {
    "Set-Cookie": session.cookie,
  });
});

admin.post("/login", async (c) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1).max(128) })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "Invalid credentials" }, 400);
  const ip = c.req.header("CF-Connecting-IP") ?? "local";
  const key = await crypto.subtle
    .digest(
      "SHA-256",
      new TextEncoder().encode(`${ip}:${body.data.email.toLowerCase()}`),
    )
    .then((v) => btoa(String.fromCharCode(...new Uint8Array(v))));
  if (!(await checkLoginLimit(c.env, key)))
    return c.json({ error: "Too many attempts. Try again later." }, 429);
  const user = await c.env.DB.prepare(
    "SELECT id,password_hash,password_salt,password_iterations,disabled FROM users WHERE email=? COLLATE NOCASE",
  )
    .bind(body.data.email)
    .first<{
      id: string;
      password_hash: string;
      password_salt: string;
      password_iterations: number;
      disabled: number;
    }>();
  const valid = Boolean(
    user &&
    !user.disabled &&
    (await verifyPassword(
      body.data.password,
      user.password_hash,
      user.password_salt,
      user.password_iterations,
    )),
  );
  await recordLogin(c.env, key, valid);
  if (!valid || !user) return c.json({ error: "Invalid credentials" }, 401);
  const session = await createSession(c.req.raw, c.env, user.id);
  return c.json({ csrfToken: session.csrfToken }, 200, {
    "Set-Cookie": session.cookie,
  });
});

admin.get("/me", (c) =>
  c.json({
    user: c.get("session").user,
    csrfToken: c.get("session").csrfToken,
  }),
);
admin.post("/logout", async (c) =>
  c.json({ ok: true }, 200, {
    "Set-Cookie": await destroySession(c.req.raw, c.env),
  }),
);

admin.get("/dashboard", async (c) => {
  const [projects, gallery, media, logs] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) count FROM projects WHERE published=1",
    ).first(),
    c.env.DB.prepare("SELECT COUNT(*) count FROM gallery_items").first(),
    c.env.DB.prepare(
      "SELECT COUNT(*) count,COALESCE(SUM(byte_size),0) bytes FROM media",
    ).first(),
    c.env.DB.prepare(
      "SELECT a.*,u.display_name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 12",
    ).all(),
  ]);
  return c.json({ projects, gallery, media, logs: logs.results });
});

admin.get("/inquiries", async (c) => c.json((await c.env.DB.prepare("SELECT * FROM commission_requests ORDER BY created_at DESC LIMIT 250").all()).results));
admin.put("/inquiries/:id", async (c) => {
  const body = z.object({ status: z.enum(["NEW","CONTACTED","ACCEPTED","DECLINED"]) }).safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "Invalid inquiry status" }, 400);
  await c.env.DB.prepare("UPDATE commission_requests SET status=? WHERE id=?").bind(body.data.status, c.req.param("id")).run();
  await audit(c.env, c.get("session").user.id, "update", "commission_request", c.req.param("id"), { status: body.data.status });
  return c.json({ ok: true });
});

admin.get("/content/:collection", async (c) => {
  const key = c.req.param("collection") as Collection;
  const config = collections[key];
  if (!config) return c.json({ error: "Unknown collection" }, 404);
  const result = await c.env.DB.prepare(
    `SELECT * FROM ${config.table} ORDER BY display_order`,
  ).all();
  return c.json(result.results);
});

admin.post("/content/:collection", async (c) => {
  const key = c.req.param("collection") as Collection;
  const config = collections[key];
  if (!config) return c.json({ error: "Unknown collection" }, 404);
  const values = cleanBody(await c.req.json(), config.fields);
  if (!Object.keys(values).length)
    return c.json({ error: "No valid fields" }, 400);
  const rowId = id();
  const columns = ["id", ...Object.keys(values)];
  try {
    await c.env.DB.prepare(
      `INSERT INTO ${config.table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`,
    )
      .bind(rowId, ...Object.values(values))
      .run();
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error && error.message.includes("UNIQUE")
            ? "A unique value is already in use"
            : "Unable to create item",
      },
      409,
    );
  }
  await audit(c.env, c.get("session").user.id, "create", key, rowId);
  return c.json({ id: rowId }, 201);
});

admin.put("/content/:collection/:id", async (c) => {
  const key = c.req.param("collection") as Collection;
  const config = collections[key];
  if (!config) return c.json({ error: "Unknown collection" }, 404);
  const values = cleanBody(await c.req.json(), config.fields);
  const entries = Object.entries(values);
  if (!entries.length) return c.json({ error: "No valid fields" }, 400);
  try {
    await c.env.DB.prepare(
      `UPDATE ${config.table} SET ${entries.map(([field]) => `${field}=?`).join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
      .bind(...entries.map(([, value]) => value), c.req.param("id"))
      .run();
  } catch {
    return c.json({ error: "Unable to save; check unique fields" }, 409);
  }
  await audit(
    c.env,
    c.get("session").user.id,
    "update",
    key,
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

admin.delete("/content/:collection/:id", async (c) => {
  const key = c.req.param("collection") as Collection;
  const config = collections[key];
  if (!config) return c.json({ error: "Unknown collection" }, 404);
  await c.env.DB.prepare(`DELETE FROM ${config.table} WHERE id=?`)
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env,
    c.get("session").user.id,
    "delete",
    key,
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

admin.post("/projects/:id/duplicate", async (c) => {
  const source = await c.env.DB.prepare("SELECT * FROM projects WHERE id=?")
    .bind(c.req.param("id"))
    .first<Record<string, unknown>>();
  if (!source) return c.json({ error: "Project not found" }, 404);
  const projectId = id();
  const slug = `${String(source.slug).slice(0, 170)}-copy-${projectId.slice(0, 6)}`;
  await c.env.DB.prepare(
    "INSERT INTO projects(id,slug,title,subtitle,description,design_goals,year,role,category,tags,cover_media_id,cover_url,external_url,roblox_url,featured,published,display_order,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      projectId,
      slug,
      `${String(source.title).slice(0, 480)} Copy`,
      source.subtitle,
      source.description,
      source.design_goals,
      source.year,
      source.role,
      source.category,
      source.tags,
      source.cover_media_id,
      source.cover_url,
      source.external_url,
      source.roblox_url,
      0,
      0,
      Number(source.display_order) + 1,
      c.get("session").user.id,
    )
    .run();
  const images = await c.env.DB.prepare(
    "SELECT media_id,image_url,alt_text,display_order FROM project_images WHERE project_id=?",
  )
    .bind(c.req.param("id"))
    .all<{
      media_id: string | null;
      image_url: string;
      alt_text: string;
      display_order: number;
    }>();
  if (images.results.length)
    await c.env.DB.batch(
      images.results.map((image) =>
        c.env.DB.prepare(
          "INSERT INTO project_images(id,project_id,media_id,image_url,alt_text,display_order) VALUES(?,?,?,?,?,?)",
        ).bind(
          id(),
          projectId,
          image.media_id,
          image.image_url,
          image.alt_text,
          image.display_order,
        ),
      ),
    );
  await audit(
    c.env,
    c.get("session").user.id,
    "duplicate",
    "projects",
    projectId,
    { sourceId: c.req.param("id") },
  );
  return c.json({ id: projectId }, 201);
});

admin.put("/content/:collection/reorder/all", async (c) => {
  const key = c.req.param("collection") as Collection;
  const config = collections[key];
  const body = z
    .object({ ids: z.array(z.string().uuid()).max(500) })
    .safeParse(await c.req.json());
  if (!config || !body.success) return c.json({ error: "Invalid order" }, 400);
  await c.env.DB.batch(
    body.data.ids.map((rowId, index) =>
      c.env.DB.prepare(
        `UPDATE ${config.table} SET display_order=? WHERE id=?`,
      ).bind(index, rowId),
    ),
  );
  await audit(c.env, c.get("session").user.id, "reorder", key, null);
  return c.json({ ok: true });
});

admin.get("/settings", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT key,value FROM site_settings ORDER BY key",
      ).all()
    ).results,
  ),
);
admin.put("/settings/:key", async (c) => {
  const key = c.req.param("key");
  if (key === "seo" && c.get("session").user.role !== "OWNER")
    return c.json(
      { error: "Only the owner can edit system configuration" },
      403,
    );
  if (!/^[a-z_]{2,40}$/.test(key))
    return c.json({ error: "Invalid setting" }, 400);
  const body = z.object({ value: z.unknown() }).safeParse(await c.req.json());
  if (!body.success || JSON.stringify(body.data.value).length > 50_000)
    return c.json({ error: "Invalid value" }, 400);
  await c.env.DB.prepare(
    "INSERT INTO site_settings(key,value,updated_by) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by",
  )
    .bind(key, JSON.stringify(body.data.value), c.get("session").user.id)
    .run();
  await audit(c.env, c.get("session").user.id, "update", "settings", key);
  return c.json({ ok: true });
});

admin.get("/media", async (c) =>
  c.json(
    (
      await c.env.DB.prepare(
        "SELECT * FROM media ORDER BY uploaded_at DESC",
      ).all()
    ).results,
  ),
);
admin.post("/media", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File))
    return c.json({ error: "Image is required" }, 400);
  const allowed = new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
  ]);
  const max = Number(c.env.MAX_UPLOAD_BYTES) || 10_485_760;
  if (!allowed.has(file.type) || file.size > max || file.size === 0)
    return c.json({ error: "Unsupported image type or size" }, 400);
  const mediaId = id();
  const extension = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/avif": "avif",
  }[file.type];
  const key = `${new Date().toISOString().slice(0, 7)}/${mediaId}.${extension}`;
  await c.env.MEDIA.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name.slice(0, 200),
      uploadedBy: c.get("session").user.id,
    },
  });
  await c.env.DB.prepare(
    "INSERT INTO media(id,filename,storage_key,url,mime_type,byte_size,alt_text,uploaded_by) VALUES(?,?,?,?,?,?,?,?)",
  )
    .bind(
      mediaId,
      file.name.slice(0, 200),
      key,
      `/media/${mediaId}`,
      file.type,
      file.size,
      String(form.get("altText") ?? "").slice(0, 500),
      c.get("session").user.id,
    )
    .run();
  await audit(c.env, c.get("session").user.id, "upload", "media", mediaId);
  return c.json({ id: mediaId, url: `/media/${mediaId}` }, 201);
});
admin.delete("/media/:id", async (c) => {
  const media = await c.env.DB.prepare(
    "SELECT storage_key FROM media WHERE id=?",
  )
    .bind(c.req.param("id"))
    .first<{ storage_key: string }>();
  if (!media) return c.json({ error: "Media not found" }, 404);
  await c.env.MEDIA.delete(media.storage_key);
  await c.env.DB.prepare("DELETE FROM media WHERE id=?")
    .bind(c.req.param("id"))
    .run();
  await audit(
    c.env,
    c.get("session").user.id,
    "delete",
    "media",
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

admin.get("/users", async (c) => {
  if (c.get("session").user.role !== "OWNER")
    return c.json({ error: "Forbidden" }, 403);
  return c.json(
    (
      await c.env.DB.prepare(
        "SELECT id,email,display_name,role,created_at,updated_at,disabled FROM users ORDER BY created_at",
      ).all()
    ).results,
  );
});
admin.post("/users", async (c) => {
  if (c.get("session").user.role !== "OWNER")
    return c.json({ error: "Forbidden" }, 403);
  const body = credentials
    .extend({ role: z.enum(["ADMIN", "EDITOR"]) })
    .safeParse(await c.req.json());
  if (!body.success || !body.data.displayName)
    return c.json({ error: "Invalid user" }, 400);
  const password = await hashPassword(body.data.password);
  const userId = id();
  try {
    await c.env.DB.prepare(
      "INSERT INTO users(id,email,display_name,role,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        userId,
        body.data.email,
        body.data.displayName,
        body.data.role,
        password.hash,
        password.salt,
        password.iterations,
      )
      .run();
  } catch {
    return c.json({ error: "Email already exists" }, 409);
  }
  await audit(c.env, c.get("session").user.id, "create", "user", userId, {
    role: body.data.role,
  });
  return c.json({ id: userId }, 201);
});
admin.put("/users/:id", async (c) => {
  if (c.get("session").user.role !== "OWNER")
    return c.json({ error: "Forbidden" }, 403);
  const body = z
    .object({
      displayName: z.string().min(2).max(80).optional(),
      role: z.enum(["ADMIN", "EDITOR"]).optional(),
      disabled: z.boolean().optional(),
      password: z.string().min(12).max(128).optional(),
    })
    .safeParse(await c.req.json());
  if (!body.success || c.req.param("id") === c.get("session").user.id)
    return c.json({ error: "Invalid user update" }, 400);
  const target = await c.env.DB.prepare("SELECT role FROM users WHERE id=?")
    .bind(c.req.param("id"))
    .first<{ role: Role }>();
  if (!target || roles[target.role] >= roles.OWNER)
    return c.json({ error: "Owner account cannot be changed here" }, 403);
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.data.displayName) {
    updates.push("display_name=?");
    values.push(body.data.displayName);
  }
  if (body.data.role) {
    updates.push("role=?");
    values.push(body.data.role);
  }
  if (body.data.disabled !== undefined) {
    updates.push("disabled=?");
    values.push(body.data.disabled ? 1 : 0);
  }
  if (body.data.password) {
    const p = await hashPassword(body.data.password);
    updates.push("password_hash=?", "password_salt=?", "password_iterations=?");
    values.push(p.hash, p.salt, p.iterations);
  }
  if (!updates.length) return c.json({ error: "No changes" }, 400);
  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(",")},updated_at=CURRENT_TIMESTAMP WHERE id=?`,
  )
    .bind(...values, c.req.param("id"))
    .run();
  if (body.data.password || body.data.disabled)
    await c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?")
      .bind(c.req.param("id"))
      .run();
  await audit(
    c.env,
    c.get("session").user.id,
    "update",
    "user",
    c.req.param("id"),
  );
  return c.json({ ok: true });
});

admin.post("/publish", async (c) => {
  const version = new Date().toISOString();
  await audit(c.env, c.get("session").user.id, "publish", "site", null, {
    version,
  });
  await c.env.PUBLICATIONS.getByName("portfolio").broadcast(version);
  return c.json({ ok: true, version });
});

export default admin;
