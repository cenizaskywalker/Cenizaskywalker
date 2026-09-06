export type Role = "OWNER" | "ADMIN" | "EDITOR";

export interface AuthUser { id: string; email: string; displayName: string; role: Role }
export interface Session { user: AuthUser; csrfToken: string; sessionHash: string }

export interface AppEnv extends Cloudflare.Env {
  DISCORD_WEBHOOK_URL?: string;
}

export interface AppVariables { session: Session }
