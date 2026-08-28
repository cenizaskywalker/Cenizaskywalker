import type { PublicContent, User } from "./types";

let csrfToken = "";
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (csrfToken && !["GET", "HEAD"].includes(options.method ?? "GET")) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(url, { ...options, headers, credentials: "same-origin" });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? `Request failed (${response.status})`);
  return payload;
}
export const api = {
  content: () => request<PublicContent>("/api/content"),
  submitCommission: (data: object) => request<{ id: string; message: string }>("/api/commission-requests", { method: "POST", body: JSON.stringify(data) }),
  project: (slug: string) => request<PublicContent["projects"][number]>(`/api/projects/${encodeURIComponent(slug)}`),
  setupStatus: () => request<{ setupRequired: boolean }>("/api/admin/setup-status"),
  setup: async (data: object) => { const result = await request<{ csrfToken: string }>("/api/admin/setup", { method: "POST", body: JSON.stringify(data) }); csrfToken = result.csrfToken; },
  login: async (data: object) => { const result = await request<{ csrfToken: string }>("/api/admin/login", { method: "POST", body: JSON.stringify(data) }); csrfToken = result.csrfToken; },
  me: async () => { const result = await request<{ user: User; csrfToken: string }>("/api/admin/me"); csrfToken = result.csrfToken; return result.user; },
  logout: () => request("/api/admin/logout", { method: "POST" }),
  get: <T>(path: string) => request<T>(`/api/admin/${path}`),
  post: <T>(path: string, data?: object | FormData) => request<T>(`/api/admin/${path}`, { method: "POST", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data: object) => request<T>(`/api/admin/${path}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (path: string) => request(`/api/admin/${path}`, { method: "DELETE" }),
};
