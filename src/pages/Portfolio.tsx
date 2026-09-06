import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Header } from "../components/Header";
import { Lightbox } from "../components/Lightbox";
import type { ImageItem, PublicContent } from "../types";

const filters = ["ALL", "HUD", "SHOP", "MENU", "ICONS", "INVENTORY", "OTHER"];

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function Portfolio() {
  const [content, setContent] = useState<PublicContent | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [requestState, setRequestState] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const [requestMessage, setRequestMessage] = useState("");

  const load = () =>
    api.content().then((data) => {
      setContent(data);
      document.title = data.seo.title;
    });

  useEffect(() => {
    void load();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${location.host}/realtime`);
    socket.onmessage = () => {
      void load();
      setNotice("New work just landed");
      window.setTimeout(() => setNotice(""), 2400);
    };
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (!content) return;
    let observer: IntersectionObserver | null = null;
    const timer = window.setTimeout(() => {
      const elements = document.querySelectorAll<HTMLElement>(
        ".chapter-head, .work-piece, .expertise-card, .archive-title, .archive-tile, .profile-statement, .profile-body, .tool-cards article, .details-section header, .details-columns article, .services-section header, .service-rows article, .process-intro, .process-section li, .commission-section > header, .pricing-row, .payment-card, .request-copy, .request-form",
      );
      elements.forEach((element, index) => {
        element.classList.add("reveal-target");
        element.style.setProperty(
          "--reveal-delay",
          `${Math.min(index % 6, 4) * 70}ms`,
        );
      });
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("in-view");
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -5%" },
      );
      observer = revealObserver;
      elements.forEach((element) => revealObserver.observe(element));
    }, 0);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [content]);

  useEffect(() => {
    const site = document.querySelector<HTMLElement>(".public-site");
    if (!site || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        site.style.setProperty("--pointer-x", `${event.clientX}px`);
        site.style.setProperty("--pointer-y", `${event.clientY}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.cancelAnimationFrame(frame);
    };
  }, [content]);

  const gallery = useMemo(
    () =>
      content?.gallery.filter(
        (item) => filter === "ALL" || item.category === filter,
      ) ?? [],
    [content, filter],
  );

  if (!content)
    return (
      <main className="boot">
        <div className="boot-mark">C</div>
        <p>Assembling interface work</p>
      </main>
    );

  const { homepage, about } = content;
  const capabilities = about.capabilityCards ?? [];
  const copyDiscord = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setNotice("Discord copied");
    window.setTimeout(() => setNotice(""), 2000);
  };

  const submitCommission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestState("sending");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const result = await api.submitCommission({
        projectType: form.get("projectType"),
        budget: form.get("budget"),
        description: form.get("description"),
        deadline: form.get("deadline"),
        discordUsername: form.get("discordUsername"),
        email: form.get("email"),
        priorityRequested: form.get("priorityRequested") === "on",
        website: form.get("website"),
      });
      setRequestState("sent");
      setRequestMessage(result.message);
      formElement.reset();
    } catch (error) {
      setRequestState("error");
      setRequestMessage(
        error instanceof Error ? error.message : "Unable to send request",
      );
    }
  };

  return (
    <div className="public-site">
      <Header />
      <main>
        <section className="landing" id="home">
          <div className="landing-grid" aria-hidden="true" />
          <div className="landing-copy">
            <div className="availability-pill">
              <span />
              {homepage.availability}
            </div>
            <p className="landing-role">
              CENIZA — {homepage.professionalTitle}
            </p>
            <h1>
              Game interfaces
              <br />
              with <em>character.</em>
            </h1>
            <p className="landing-lead">{homepage.heroDescription}</p>
            <div className="landing-actions">
              <a href="#work" className="action action-dark">
                Explore work <b>↓</b>
              </a>
              <a href="#contact" className="action action-line">
                Book a commission <b>↗</b>
              </a>
            </div>
          </div>
          <div className="design-desk">
            <div className="desk-toolbar">
              <span>SELECTED_UI.fig</span>
              <div>
                <i />
                <i />
                <i />
              </div>
              <b>100%</b>
            </div>
            <div className="desk-canvas">
              <div className="desk-ruler ruler-top" />
              <div className="desk-ruler ruler-side" />
              <figure className="desk-main">
                <img
                  src={homepage.heroMediaUrls[0]}
                  alt="Featured Roblox UI interface"
                  fetchPriority="high"
                />
              </figure>
              <figure className="desk-float desk-float-a">
                <img src={homepage.heroMediaUrls[1]} alt="Shop UI preview" />
              </figure>
              <figure className="desk-float desk-float-b">
                <img
                  src={homepage.heroMediaUrls[2]}
                  alt="Settings UI preview"
                />
              </figure>
              <div className="cursor-tag">
                <i /> CENIZA <span>Designing</span>
              </div>
              <div className="desk-note">
                UI that belongs
                <br />
                to the game world.
              </div>
            </div>
          </div>
          <aside className="landing-side">
            <span>SCROLL TO EXPLORE</span>
            <i />
          </aside>
        </section>

        <section className="work-section" id="work">
          <header className="chapter-head">
            <div>
              <span>01</span>
              <p>Selected projects</p>
            </div>
            <h2>
              Built for play.
              <br />
              <em>Designed to belong.</em>
            </h2>
            <p>
              Large-scale interface work where hierarchy, style and interaction
              meet.
            </p>
          </header>
          <div className="work-stack">
            {content.projects.map((project, index) => (
              <Link
                className={`work-piece piece-${index + 1}`}
                to={`/work/${project.slug}`}
                key={project.id}
              >
                <div className="work-media">
                  <img
                    src={project.cover_url}
                    alt={`${project.title} interface`}
                    loading={index === 0 ? "eager" : "lazy"}
                  />
                  <span className="work-open">Open project ↗</span>
                  <span className="work-number">0{index + 1}</span>
                </div>
                <div className="work-info">
                  <div>
                    <small>{project.category || "GAME UI"}</small>
                    <h3>{project.title}</h3>
                  </div>
                  <p>{project.description}</p>
                  <div className="work-tags">
                    {project.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {capabilities.length > 0 && (
          <section className="expertise" id="expertise">
            <header className="chapter-head chapter-light">
              <div>
                <span>02</span>
                <p>Design expertise</p>
              </div>
              <h2>
                A visual system,
                <br />
                <em>not isolated screens.</em>
              </h2>
              <p>
                Every part is designed to work as a recognizable, usable whole.
              </p>
            </header>
            <div className="expertise-board">
              {capabilities.map((card, index) => (
                <article
                  className={`expertise-card expertise-${index + 1}`}
                  key={card.title}
                >
                  <div className="expertise-top">
                    <span>0{index + 1}</span>
                    <i>{index % 2 ? "SYSTEM" : "SPECIALTY"}</i>
                  </div>
                  <figure>
                    <img
                      src={card.image}
                      alt={`${card.title} example`}
                      loading="lazy"
                    />
                  </figure>
                  <div className="expertise-copy">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="archive-section" id="archive">
          <header className="archive-title">
            <div>
              <span>03</span>
              <p>Visual archive</p>
            </div>
            <h2>
              Small screens.
              <br />
              Big decisions.
            </h2>
            <p>{gallery.length.toString().padStart(2, "0")} pieces shown</p>
          </header>
          <div className="archive-filters">
            {filters.map((value) => (
              <button
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                key={value}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="archive-wall">
            {gallery.map((item, index) => (
              <button
                className={`archive-tile tile-${index % 7}`}
                onClick={() => setLightbox(index)}
                key={item.id}
              >
                <img src={item.image_url} alt={item.alt_text} loading="lazy" />
                <span>
                  <b>{item.title}</b>
                  <small>{item.category} · EXPAND ↗</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="profile-section" id="about">
          <div className="profile-statement">
            <span className="profile-label">04 / THE DESIGNER</span>
            <h2>
              I turn game ideas into interfaces players{" "}
              <em>understand instantly.</em>
            </h2>
          </div>
          <div className="profile-body">
            <p>{about.biography}</p>
            <div className="profile-pills">
              {about.specialties.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>
          <div className="tool-cards">
            {about.tools.map((tool, index) => (
              <article key={tool}>
                <span>0{index + 1}</span>
                <div className={`tool-glyph glyph-${index + 1}`}>
                  {tool.charAt(0)}
                </div>
                <h3>{tool}</h3>
                <p>
                  {index === 0
                    ? "Systems, components and high-fidelity layouts"
                    : index === 1
                      ? "Game context, scale and responsive validation"
                      : "Asset polish, textures and visual treatment"}
                </p>
              </article>
            ))}
          </div>
        </section>

        {content.portfolio_details && (
          <section className="details-section">
            <header>
              <span>05 / WHAT YOU CAN EXPECT</span>
              <h2>{content.portfolio_details.introTitle}</h2>
              <div>
                {content.portfolio_details.introParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </header>
            <div className="details-columns">
              <article>
                <span>WHAT I CAN DO</span>
                <ul>
                  {content.portfolio_details.whatICanDo.map((item) => (
                    <li key={item}>
                      <i>✦</i>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
              <article>
                <span>WHY HIRE ME</span>
                <ul>
                  {content.portfolio_details.whyHire.map((item) => (
                    <li key={item}>
                      <i>✓</i>
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>
        )}

        <section className="services-section">
          <header>
            <span>05 / SERVICES</span>
            <h2>
              Choose the scale.
              <br />I build the language.
            </h2>
          </header>
          <div className="service-rows">
            {content.services.map((service, index) => (
              <article key={service.id}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </div>
                <b>↗</b>
              </article>
            ))}
          </div>
        </section>

        <section className="process-section">
          <div className="process-intro">
            <span>06 / WORKFLOW</span>
            <h2>
              Clear process.
              <br />
              No guessing.
            </h2>
            <p>
              From first conversation to organized final assets, every stage has
              a purpose.
            </p>
          </div>
          <ol>
            {content.process.map((step, index) => (
              <li key={step.id}>
                <div className="step-orbit">
                  <span>{index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="commission-section" id="commissions">
          <header>
            <div>
              <span>07 / COMMISSIONS</span>
              <h2>{content.pricing_intro.title}</h2>
            </div>
            <p>{content.pricing_intro.description}</p>
          </header>
          <div className="pricing-layout">
            <div className="pricing-table">
              {content.pricing.map((item, index) => (
                <article
                  className={`pricing-row ${item.featured ? "featured" : ""}`}
                  key={item.id}
                >
                  <span className="pricing-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="pricing-summary">
                    <div>
                      <h3>{item.title}</h3>
                      {item.featured && <b>BEST START</b>}
                    </div>
                    <p>{item.description}</p>
                    <ul>
                      {parseList(item.features).map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                  <dl>
                    <div>
                      <dt>Delivery</dt>
                      <dd>{item.turnaround || "After brief"}</dd>
                    </div>
                    <div>
                      <dt>Revisions</dt>
                      <dd>{item.revisions || "By scope"}</dd>
                    </div>
                  </dl>
                  <div className="pricing-quote">
                    <small>STARTING POINT</small>
                    <strong>{item.price_label || "Custom quote"}</strong>
                    <a href="#contact">
                      Request quote <b>↗</b>
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <aside className="payment-card">
              <span>PAYMENT STRUCTURE</span>
              <div className="payment-split">
                <div>
                  <strong>50%</strong>
                  <small>Before work starts</small>
                </div>
                <i />
                <div>
                  <strong>50%</strong>
                  <small>Before final delivery</small>
                </div>
              </div>
              <h3>Clear terms. No surprises.</h3>
              <ul>
                <li>PayPal payments only</li>
                <li>Watermarked previews until fully paid</li>
                <li>Final quote depends on scope and complexity</li>
                <li>Priority delivery may increase the quote</li>
              </ul>
              <a href="#contact">
                Start a commission <b>↗</b>
              </a>
            </aside>
          </div>
          <p className="commission-disclaimer">
            Every figure is a starting point. Screen count, visual detail,
            animation, revisions and deadline define the final quote.
          </p>
        </section>

        <section className="request-section" id="contact">
          <div className="closing-grid" aria-hidden="true" />
          <div className="request-copy">
            <span>08 / COMMISSION REQUEST</span>
            <h2>
              Bring me the interface your game <em>needs.</em>
            </h2>
            <p>
              Share the project type, scope, budget and deadline. Email is the
              preferred contact method; Discord is requested as a backup so I
              can reach you reliably.
            </p>
            <div className="closing-actions">
              {content.socials.map((social) =>
                social.copy_value ? (
                  <button
                    onClick={() => void copyDiscord(String(social.copy_value))}
                    key={social.id}
                  >
                    Copy {social.platform}
                    <b>⧉</b>
                  </button>
                ) : social.url ? (
                  <a
                    href={String(social.url)}
                    target="_blank"
                    rel="noreferrer"
                    key={social.id}
                  >
                    {social.label || social.platform}
                    <b>↗</b>
                  </a>
                ) : null,
              )}
            </div>
            {content.portfolio_details && (
              <div className="payment-mini">
                <span>PAYMENT & DELIVERY</span>
                <p>
                  {content.portfolio_details.payment.method} ·{" "}
                  {content.portfolio_details.payment.deposit}
                </p>
                <p>{content.portfolio_details.payment.delivery}</p>
              </div>
            )}
          </div>
          <form className="request-form" onSubmit={submitCommission}>
            <div className="request-form-head">
              <span>PROJECT BRIEF</span>
              <b>
                {requestState === "sending"
                  ? "SENDING..."
                  : "OPEN FOR COMMISSIONS"}
              </b>
            </div>
            <div className="request-fields">
              <label>
                Project type
                <input
                  name="projectType"
                  placeholder="Shop, HUD, inventory, full UI package..."
                  required
                  minLength={3}
                />
              </label>
              <label>
                Budget
                <input name="budget" placeholder="$ USD" required />
              </label>
              <label className="request-wide">
                Project description
                <textarea
                  name="description"
                  rows={7}
                  placeholder="Tell me about the game, required screens, visual direction and expected deliverables..."
                  required
                  minLength={30}
                />
              </label>
              <label>
                Deadline
                <input
                  name="deadline"
                  placeholder="Flexible / 1 week / specific date"
                  required
                />
              </label>
              <label>
                Email · preferred contact
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@gmail.com"
                  required
                />
                <small>I will contact you here first.</small>
              </label>
              <label>
                Discord · backup contact
                <input
                  name="discordUsername"
                  autoComplete="off"
                  placeholder="username"
                  required
                />
                <small>Used if email is unavailable.</small>
              </label>
              <label className="request-honeypot" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="priority-option">
              <input name="priorityRequested" type="checkbox" />
              <span />
              <div>
                <strong>Priority delivery</strong>
                <small>
                  I understand urgent delivery may increase the quote.
                </small>
              </div>
            </label>
            <button
              className="request-submit"
              disabled={requestState === "sending"}
            >
              {requestState === "sending"
                ? "Sending request..."
                : "Send commission request"}
              <b>↗</b>
            </button>
            {requestMessage && (
              <p className={`request-result ${requestState}`}>
                {requestMessage}
              </p>
            )}
          </form>
        </section>
      </main>
      <footer className="public-footer">
        <div>
          <strong>CENIZA</strong>
          <span>ROBLOX UI DESIGNER</span>
        </div>
        <p>{content.seo.footerText}</p>
        <a href="#home">Back to top ↑</a>
      </footer>
      {lightbox !== null && (
        <Lightbox
          images={gallery as ImageItem[]}
          initial={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
      <div className={notice ? "site-toast show" : "site-toast"} role="status">
        {notice}
      </div>
    </div>
  );
}
