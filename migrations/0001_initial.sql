PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','EDITOR')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0,1))
);
CREATE UNIQUE INDEX one_owner ON users(role) WHERE role = 'OWNER';

CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_prefix TEXT
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  blocked_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  design_goals TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  cover_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  cover_url TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  roblox_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE project_images (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE gallery_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'OTHER',
  media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL DEFAULT '',
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE process_steps (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE pricing_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_label TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE social_links (id TEXT PRIMARY KEY, platform TEXT NOT NULL, label TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '', copy_value TEXT NOT NULL DEFAULT '', enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE stats (id TEXT PRIMARY KEY, label TEXT NOT NULL, value TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN(0,1)), display_order INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX audit_recent ON audit_logs(created_at DESC);

INSERT INTO site_settings(key,value) VALUES
('homepage','{"designerName":"CENIZA","professionalTitle":"ROBLOX UI DESIGNER","heroHeadline":"Interfaces players remember.","heroDescription":"I design clear, expressive UI systems that give Roblox games their own visual identity.","availability":"Available for commissions","location":"Mexico","primaryCta":"Explore selected work","secondaryCta":"Start a project","heroMediaUrls":["/portfolio/BotonesArriba.png","/portfolio/ShopFrame.png","/portfolio/SettingsFrame.png"],"sectionVisibility":{"work":true,"gallery":true,"range":true,"about":true,"services":true,"process":true,"pricing":true,"contact":true}}'),
('about','{"biography":"I am Ceniza, a UI designer focused on Roblox experiences. I combine visual hierarchy, usability and game identity to make interfaces that feel natural to use and specific to the world they belong to.","specialties":["Game UI","UI / UX","HUD Design","Inventories","Shop Systems","Responsive UI","Icon Design","Menus"],"tools":["Figma","Roblox Studio","Photoshop"],"styles":[{"name":"Modern","description":"Clear systems with confident hierarchy.","image":"/portfolio/SettingsFrame.png"},{"name":"Stylized","description":"Expressive forms built around the game world.","image":"/portfolio/comision2.png"},{"name":"Horror","description":"Atmospheric interfaces that protect immersion.","image":"/portfolio/comision12.png"},{"name":"Minimal","description":"Purposeful screens without visual noise.","image":"/portfolio/inventario.png"}]}'),
('seo','{"title":"Ceniza — Roblox UI Designer","description":"Roblox UI designer creating HUDs, shops, inventories, menus and complete interface systems.","canonicalUrl":"","ogImage":"","favicon":"/favicon.svg","footerText":"Designed by Ceniza"}'),
('pricing_intro','{"title":"Pricing shaped around the work.","description":"Every game needs a different level of detail. Quotes consider scope, complexity, screen count, revisions and deadline."}');

INSERT INTO projects(id,slug,title,subtitle,description,year,role,category,tags,cover_url,featured,published,display_order) VALUES
('project-coffee','grow-a-coffee-empire','Grow a Coffee Empire','Complete game interface','A cohesive interface direction for a coffee-building experience, balancing playful character with fast access to core actions.','','UI Design','Complete UI System','["Game UI","HUD","Stylized"]','/portfolio/BotonesArriba.png',1,1,0),
('project-shop','shop-interface','Shop Interface','Premium purchase flow','A focused shop screen designed to make product choices clear while keeping the game identity present.','','UI Design','Shop','["Shop","Modern"]','/portfolio/ShopFrame.png',1,1,1),
('project-settings','settings-interface','Settings Interface','Clear player controls','A compact settings experience with readable grouping and strong interaction states.','','UI Design','Menu','["Menu","Minimal"]','/portfolio/SettingsFrame.png',0,1,2);

INSERT INTO project_images(id,project_id,image_url,alt_text,display_order) VALUES
('pi-coffee-1','project-coffee','/portfolio/BotonesArriba.png','Grow a Coffee Empire top navigation UI',0),
('pi-coffee-2','project-coffee','/portfolio/BotonesFrame.png','Grow a Coffee Empire button panel',1),
('pi-shop-1','project-shop','/portfolio/ShopFrame.png','Robux shop interface',0),
('pi-shop-2','project-shop','/portfolio/comision2.png','Additional shop interface',1),
('pi-settings-1','project-settings','/portfolio/SettingsFrame.png','Settings interface',0);

INSERT INTO services(id,title,description,display_order) VALUES
('service-elements','UI Elements','Buttons, icons, counters, badges, notifications and individual interface components.',0),
('service-screens','UI Screens','Shops, inventories, quests, menus, settings, loading screens and more.',1),
('service-systems','Complete UI Systems','A cohesive interface package designed around your game identity and player experience.',2);
INSERT INTO process_steps(id,title,description,display_order) VALUES
('process-discuss','Discuss','We define the game, scope, references and visual direction.',0),('process-design','Design','I create the interface direction and primary concepts.',1),('process-refine','Refine','We review feedback and improve the design together.',2),('process-deliver','Deliver','Final assets are organized and prepared for implementation.',3);
INSERT INTO social_links(id,platform,label,url,copy_value,display_order) VALUES
('social-discord','Discord','ceniza_sky','','ceniza_sky',0),('social-roblox','Roblox','Roblox profile','https://www.roblox.com/users/1904648029/profile','',1);

INSERT INTO gallery_items(id,title,alt_text,category,image_url,featured,display_order) VALUES
('gallery-01','Shop UI','Stylized shop interface','SHOP','/portfolio/comision2.png',1,0),('gallery-02','Inventory','Inventory game interface','INVENTORY','/portfolio/inventario.png',1,1),('gallery-03','Vehicle Shop','Vehicle selection shop interface','SHOP','/portfolio/comision3.png',0,2),('gallery-04','Game Buttons','Collection of stylized UI buttons','ICONS','/portfolio/botonescomisiones.png',0,3),('gallery-05','Armory','Armory selection interface','MENU','/portfolio/comision12.png',0,4),('gallery-06','Defense Screen','Defensive equipment interface','MENU','/portfolio/comision13 (1).png',0,5),('gallery-07','Utilities Screen','Utilities interface','MENU','/portfolio/comision14 (1).png',0,6),('gallery-08','Shop Screen','Colorful shop interface','SHOP','/portfolio/comision15.png',0,7),('gallery-09','Stamp Collection I','Stamp collection interface','OTHER','/portfolio/comision16.png',0,8),('gallery-10','Stamp Collection II','Stamp collection interface variation','OTHER','/portfolio/comision17.png',0,9),('gallery-11','Stamp Collection III','Stamp collection interface variation','OTHER','/portfolio/comision18.png',0,10),('gallery-12','Stamp Collection IV','Stamp collection interface variation','OTHER','/portfolio/comision19.png',0,11),('gallery-13','Stamp Collection V','Stamp collection interface variation','OTHER','/portfolio/comision20.png',0,12);
