# Ceniza — Roblox UI Designer Portfolio & CMS

Production-oriented portfolio and lightweight CMS. The public experience is visual-first; the protected admin persists content in Cloudflare D1, stores uploads in R2, and broadcasts publications through a Durable Object WebSocket hub.

## Architecture

- **React + Vite + strict TypeScript** — public portfolio, project routes, accessible lightbox and `/admin`.
- **Cloudflare Worker + Hono** — API routing, validation, security headers and asset delivery.
- **Cloudflare D1** — normalized content, users, sessions and audit history.
- **Cloudflare R2** — reusable media library. Original PNGs remain bundled; new uploads use R2.
- **Durable Objects** — hibernating WebSockets for publication notifications and isolated PBKDF2 password hashing with a free-tier-compatible CPU budget. D1 remains the source of truth for users, sessions and content.

Public content is read from `/api/content`; it is not sourced from frontend JSON or localStorage.

## Structure

```text
src/                 React application
worker/              Worker API, auth, content and publication hub
migrations/          Ordered D1 schema and seed migration
public/portfolio/    Migrated existing artwork
ImagesWorks/         Preserved original source assets
wrangler.jsonc       Assets, D1, R2 and Durable Object bindings
```

## Local development

Requires Node.js 20+ and npm.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Open `http://localhost:5173/` and `http://localhost:5173/admin`. When D1 has zero users, the admin creates the first `OWNER`. A database uniqueness constraint and conditional insert permanently close setup afterward. Use a password of at least 12 characters. No default credentials exist.

Local binding state lives in `.wrangler/` and is gitignored. Delete it only when intentionally resetting local development.

## Roles

- **OWNER** — all content, users, roles, credential resets and critical SEO/system settings.
- **ADMIN** — portfolio content, projects, media, gallery, services, pricing and publishing.
- **EDITOR** — portfolio content and uploads; no users or critical configuration.

Every protected API route verifies a server-side session. Mutations also require the session CSRF token. UI visibility is not authorization.

## Entering the admin panel

1. Start the app with `npm run dev`.
2. Open `http://127.0.0.1:5173/admin`.
3. On a fresh database, the page automatically shows **First Owner Setup**. Enter a display name, email and a password with at least 12 characters.
4. After the first owner exists, `/admin` shows the normal sign-in screen. No default username or password is stored in this repository.

The admin navigation includes:

- **Inquiries** — commission requests sent from the public form and their current status.
- **Projects / Gallery / Media** — portfolio work and reusable images.
- **Pricing** — edit the package title, public price label, description, included deliverables, turnaround, revisions, recommended state and visibility.
- **Homepage / About / Settings** — edit public copy and site configuration.
- **Users** — owner-only account and role management.

To change a displayed price, open **Admin → Pricing**, choose **Edit**, update **price label** (for example, `Starting at $50 USD` or `Custom quote`), and save. Press **Publish site** when the public update is ready.

The public form asks for an email address as the preferred contact method and a Discord username as backup. New requests are stored in D1 and appear under **Admin → Inquiries**.

## Discord commission notifications

Create a fresh Discord webhook, then store it as a Worker secret. Never place its URL in frontend code, `wrangler.jsonc`, commits or screenshots.

For local development, copy `.dev.vars.example` to `.dev.vars` and replace its placeholder. For production, run:

```bash
npx wrangler secret put DISCORD_WEBHOOK_URL
```

The notification posts `@everyone` with an embed containing the project type, budget, description, deadline, preferred email, backup Discord username and priority status. If the secret is absent, the request is still saved in D1 but no Discord notification is attempted.

If the local database already contains an owner whose password is unknown, do not add credentials to source files. Intentionally reset only the local Wrangler state or use an existing OWNER account to reset another user's password.

## Content, publishing and media

The seed migration preserves existing projects, gallery images, services, process copy and public links. Missing years, prices and stats stay blank or disabled rather than being invented.

Edits save to D1. **Publish site** records an audit event and broadcasts a version notification; connected clients refetch D1-backed content. New visitors always receive current content.

Uploads accept PNG, JPEG, WebP and AVIF. The Worker checks MIME and size before streaming to R2. The default limit is 10 MiB. Generated `/media/:id` URLs are immutable. A future Cloudflare Images or processing pipeline is recommended for multiple responsive derivatives.

## Production deployment

```bash
npx wrangler login
npx wrangler d1 create ceniza-portfolio
npx wrangler r2 bucket create ceniza-portfolio-media
npm run db:migrate:remote
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

Replace the placeholder D1 `database_id` in `wrangler.jsonc` with the ID returned at creation. The Durable Object namespace and migration deploy with the Worker. After deploy, visit `/admin` and create the first owner.

Non-secret configuration in `wrangler.jsonc`:

- `SESSION_TTL_SECONDS` — session lifetime (default seven days).
- `MAX_UPLOAD_BYTES` — server-side upload ceiling.

Copy `.dev.vars.example` to `.dev.vars` only for future local secrets. Never use `VITE_*` for secrets. Add production secrets interactively with `npx wrangler secret put NAME`.

## Migrations and backups

```bash
npx wrangler d1 migrations create ceniza-portfolio describe_change
npx wrangler d1 export ceniza-portfolio --remote --output backup.sql
```

Never modify an applied production migration. Preserve D1 exports and R2 objects under a documented recovery policy before significant changes.

## Validation

```bash
npm run typecheck
npm run test
npm run build
npx wrangler deploy --dry-run
```

Security includes PBKDF2-SHA-256 with per-user salts delegated to a per-user Durable Object, hashed opaque session IDs, HttpOnly/SameSite cookies, Secure HTTPS cookies, CSRF checks, login throttling, parameterized SQL, role checks, restricted uploads and HTTP security headers.

## Notes

- Replace the placeholder canonical domain in `public/robots.txt` and `public/sitemap.xml` once the custom domain is known.
- Configure canonical/OG media through `/admin/settings` after deployment.
- GitHub Pages cannot host this Worker/D1/R2 CMS; deploy the full app through Cloudflare Workers.
- Never commit `.dev.vars`, credentials, backups or `.wrangler` state.
