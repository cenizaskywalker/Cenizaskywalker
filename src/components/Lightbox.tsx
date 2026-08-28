import { useEffect, useRef, useState } from "react";
import type { ImageItem } from "../types";

export function Lightbox({ images, initial, onClose }: { images: ImageItem[]; initial: number; onClose: () => void }) {
  const [index, setIndex] = useState(initial); const closeRef = useRef<HTMLButtonElement>(null);
  const move = (amount: number) => setIndex((value) => (value + amount + images.length) % images.length);
  useEffect(() => { closeRef.current?.focus(); const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); if (event.key === "ArrowRight") move(1); if (event.key === "ArrowLeft") move(-1); }; document.addEventListener("keydown", handler); document.body.classList.add("locked"); return () => { document.removeEventListener("keydown", handler); document.body.classList.remove("locked"); }; }, []);
  const image = images[index];
  return <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" onClick={onClose}>
    <button ref={closeRef} className="lightbox-close" onClick={onClose} aria-label="Close viewer">×</button>
    {images.length > 1 && <button className="lightbox-prev" onClick={(e) => { e.stopPropagation(); move(-1); }} aria-label="Previous image">←</button>}
    <figure onClick={(e) => e.stopPropagation()}><img src={image.image_url} alt={image.alt_text} /><figcaption>{image.title ?? image.alt_text}<span>{index + 1} / {images.length}</span></figcaption></figure>
    {images.length > 1 && <button className="lightbox-next" onClick={(e) => { e.stopPropagation(); move(1); }} aria-label="Next image">→</button>}
  </div>;
}
