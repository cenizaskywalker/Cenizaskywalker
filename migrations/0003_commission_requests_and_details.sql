CREATE TABLE commission_requests (
  id TEXT PRIMARY KEY,
  project_type TEXT NOT NULL,
  budget TEXT NOT NULL,
  description TEXT NOT NULL,
  deadline TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  roblox_username TEXT NOT NULL DEFAULT '',
  priority_requested INTEGER NOT NULL DEFAULT 0 CHECK(priority_requested IN(0,1)),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK(status IN('NEW','CONTACTED','ACCEPTED','DECLINED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX commission_requests_recent ON commission_requests(created_at DESC);

CREATE TABLE commission_request_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);

INSERT INTO site_settings(key,value) VALUES
('portfolio_details','{"introTitle":"Roblox UI design made to feel good in play.","introParagraphs":["I create high-quality Roblox interfaces focused on clean visuals, smooth player experience and a strong modern finish.","My workflow combines Figma prototyping, Roblox Studio context and game-ready organization. I can adapt from minimal and modern UI to colorful, stylized and detailed systems.","Every project is treated seriously, with careful attention to hierarchy, usability, feedback and the identity of the game."],"whatICanDo":["Minimal and modern interface design","Studs-style simulator interfaces","Complete shops with categories, currencies and gamepasses","Interactive buttons and satisfying states","Coin, gem, level, timer and progression counters","Custom tags, badges, emblems and role displays","Loading screens and reward presentations","Scalable inventory systems","Daily login and reward interfaces","Quest and mission progress systems","Readable dialog and notification systems","Responsive direction for PC, tablet and mobile","Fully custom UI matched to the game theme"],"whyHire":["Polished work with attention to detail","Creative and adaptable across different visual styles","Clear communication and openness to feedback","Efficient Figma and Roblox Studio workflow","Custom interfaces rather than generic templates","PC and mobile players considered from the start","Budget-conscious options without ignoring quality","Consistent progress updates throughout the project"],"payment":{"method":"PayPal only","deposit":"50% upfront before work begins","balance":"Remaining 50% before final delivery","watermark":"Preview watermarks remain until full payment","delivery":"Estimated 1 to 3 days depending on complexity and workload","priority":"Urgent or priority delivery may require a higher quote"}}')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;
