import type { AppEnv } from "./types";

const parse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export async function getPublicContent(env: AppEnv): Promise<Record<string, unknown>> {
  const [settings, projects, images, gallery, services, process, pricing, socials, stats] = await Promise.all([
    env.DB.prepare("SELECT key,value FROM site_settings").all<{ key: string; value: string }>(),
    env.DB.prepare("SELECT * FROM projects WHERE published=1 ORDER BY featured DESC,display_order,title").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM project_images ORDER BY display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM gallery_items WHERE enabled=1 ORDER BY featured DESC,display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM services WHERE enabled=1 ORDER BY display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM process_steps WHERE enabled=1 ORDER BY display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM pricing_items WHERE enabled=1 ORDER BY display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM social_links WHERE enabled=1 ORDER BY display_order").all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM stats WHERE enabled=1 AND value<>'' ORDER BY display_order").all<Record<string, unknown>>(),
  ]);
  const settingMap = Object.fromEntries(settings.results.map((row) => [row.key, parse(row.value, {})]));
  return { ...settingMap, projects: projects.results.map((project) => ({ ...project, tags: parse(String(project.tags), []), images: images.results.filter((image) => image.project_id === project.id) })), gallery: gallery.results, services: services.results, process: process.results, pricing: pricing.results, socials: socials.results, stats: stats.results, version: new Date().toISOString() };
}
