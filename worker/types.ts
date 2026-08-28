import type { PublicationHub } from "./publication-hub";

export type Role = "OWNER" | "ADMIN" | "EDITOR";

export interface AuthUser { id: string; email: string; displayName: string; role: Role }
export interface Session { user: AuthUser; csrfToken: string; sessionHash: string }

export interface AppEnv {
  DB: D1Database;
  MEDIA: R2Bucket;
  PUBLICATIONS: DurableObjectNamespace<PublicationHub>;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  SESSION_TTL_SECONDS: string;
  MAX_UPLOAD_BYTES: string;
  DISCORD_WEBHOOK_URL?: string;
}

export interface AppVariables { session: Session }
