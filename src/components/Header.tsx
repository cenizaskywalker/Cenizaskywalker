import { useState } from "react";
import { Link } from "react-router-dom";

const links = [
  ["Work", "/#work"],
  ["Expertise", "/#expertise"],
  ["Archive", "/#archive"],
  ["About", "/#about"],
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="nav-shell">
      <Link to="/" className="nav-brand" aria-label="Ceniza home">
        <span className="nav-brand-mark">C</span>
        <span><strong>CENIZA</strong><small>ROBLOX UI DESIGNER</small></span>
      </Link>
      <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
        {links.map(([label, href], index) => <a href={href} key={href} onClick={() => setOpen(false)}><i>0{index + 1}</i>{label}</a>)}
      </nav>
      <a className="nav-contact" href="/#contact"><span />Start a project <b>↗</b></a>
      <button className="nav-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle menu">
        <span /><span />
      </button>
    </header>
  );
}
