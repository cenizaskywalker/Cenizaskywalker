import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { Header } from "../components/Header";
import { Lightbox } from "../components/Lightbox";
import type { Project } from "../types";

export function ProjectPage() {
  const { slug = "" } = useParams();
  const [project, setProject] = useState<Project | null>();
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    api.project(slug).then((data) => {
      setProject(data);
      document.title = `${data.title} — Ceniza`;
    }).catch(() => setProject(null));
  }, [slug]);

  if (project === undefined) return <main className="boot"><div className="boot-mark">C</div><p>Opening project</p></main>;
  if (project === null) return <main className="missing"><span>404 / PROJECT</span><h1>This project is not available.</h1><Link to="/">Return to portfolio →</Link></main>;

  return <div className="public-site project-route">
    <Header />
    <main>
      <header className="project-hero">
        <div className="project-crumb"><Link to="/#work">← Selected work</Link><span>{project.category || "Game UI"}</span></div>
        <div className="project-title"><span>CASE STUDY / {project.year || "SELECTED"}</span><h1>{project.title}</h1><p>{project.subtitle}</p></div>
        <dl><div><dt>Role</dt><dd>{project.role || "UI Designer"}</dd></div><div><dt>Scope</dt><dd>{project.tags.join(" / ")}</dd></div><div><dt>Year</dt><dd>{project.year || "Not listed"}</dd></div></dl>
      </header>
      <figure className="project-cover"><div className="project-cover-bar"><span>{project.slug}.fig</span><b>FINAL UI</b></div><img src={project.cover_url} alt={`${project.title} interface cover`} /></figure>
      <section className="project-brief"><span>01 / OVERVIEW</span><div><h2>{project.description}</h2>{project.design_goals && <p>{project.design_goals}</p>}</div></section>
      <section className="project-shots"><header><span>02 / INTERFACE VIEWS</span><p>Click any image to inspect the full-resolution design.</p></header>{project.images.map((image, index) => <button onClick={() => setLightbox(index)} key={image.id}><span>0{index + 1}</span><img src={image.image_url} alt={image.alt_text} loading="lazy" /><b>EXPAND ↗</b></button>)}</section>
      {(project.external_url || project.roblox_url) && <nav className="project-outbound">{project.roblox_url && <a href={project.roblox_url} target="_blank" rel="noreferrer">View Roblox experience ↗</a>}{project.external_url && <a href={project.external_url} target="_blank" rel="noreferrer">Visit project ↗</a>}</nav>}
      <Link className="project-next" to="/#work"><span>BACK TO PORTFOLIO</span><strong>Explore more work <b>→</b></strong></Link>
    </main>
    {lightbox !== null && <Lightbox images={project.images} initial={lightbox} onClose={() => setLightbox(null)} />}
  </div>;
}
