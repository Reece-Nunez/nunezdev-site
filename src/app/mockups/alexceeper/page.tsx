/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5
 * Hallmark · genre: editorial · macrostructure: Split Studio
 * theme: custom (warm off-black paper · volt-lime accent · Archivo + Space Grotesk + Geist Mono)
 * enrichment: Tier-A CSS emblem + caution-stripe panel · nav: N6 masthead · footer: Ft5 statement
 *
 * Concept storefront mockup for the lead "Alexceeper" (merch brand). Self-contained,
 * scoped under `.axk` so the global Space Grotesk/Lora rules don't leak in. noindex —
 * this is a client sales concept, not real site content. */
import type { Metadata } from "next";
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alexceeper — Concept Mockup",
  description: "A concept storefront mockup built by NunezDev for Alexceeper.",
  robots: { index: false, follow: false },
};

const drop = [
  { no: "01", name: "Voyager Hoodie", spec: "Heavyweight fleece · 480gsm", price: "68", ways: ["#2b2a27", "#6d6a60", "#c9c3b2"] },
  { no: "02", name: "Signal Tee", spec: "Boxed cotton · 240gsm", price: "34", ways: ["#22211e", "#b8b2a2", "#a9c452"] },
  { no: "03", name: "Grid Cap", spec: "Structured 6-panel", price: "28", ways: ["#26251f", "#5a5648"] },
  { no: "04", name: "Static Crewneck", spec: "Brushed loopback · 400gsm", price: "58", ways: ["#2a2925", "#8f8a7c", "#3c4a63"] },
];

export default function AlexceeperMockup() {
  return (
    <main className={`${archivo.variable} axk`}>
      <style>{css}</style>

      {/* Concept attribution — clearly a demo, keeps NunezDev on it */}
      <div className="axk-ribbon">
        <span>Concept mockup for <strong>Alexceeper</strong></span>
        <a href="https://www.nunezdev.com" target="_blank" rel="noreferrer">built by NunezDev →</a>
      </div>

      {/* N6 masthead nav */}
      <header className="axk-mast">
        <a href="#top" className="axk-word">ALEXCEEPER</a>
        <nav className="axk-mast__nav">
          <a href="#drop">Drop 001</a>
          <a href="#lookbook">Lookbook</a>
          <a href="#story">Story</a>
          <a href="#drop" className="axk-btn axk-btn--sm">Shop</a>
        </nav>
      </header>

      {/* Hero — Split Studio diptych */}
      <section id="top" className="axk-hero">
        <div className="axk-hero__copy">
          <p className="axk-kicker">Drop 001 — now live</p>
          <h1 className="axk-h1">Gear for people who keep&nbsp;going.</h1>
          <p className="axk-lede">
            Heavyweight essentials built to outlast the hype. Small runs, no
            restocks — only the pieces that earn a place in the rotation.
          </p>
          <div className="axk-hero__cta">
            <a href="#drop" className="axk-btn">Shop the drop</a>
            <a href="#lookbook" className="axk-btn axk-btn--ghost">See the lookbook</a>
          </div>
        </div>
        <div className="axk-hero__art" aria-hidden="true">
          <div className="axk-emblem">
            <span className="axk-emblem__ring" />
            <span className="axk-emblem__ring axk-emblem__ring--2" />
            <span className="axk-emblem__mark">AK</span>
            <span className="axk-emblem__tag">EST · MMXXVI</span>
          </div>
        </div>
      </section>

      {/* Type band */}
      <div className="axk-band" aria-hidden="true">
        <span>KEEP GOING</span><span className="axk-band__dot" /><span>KEEP GOING</span>
      </div>

      {/* Drop — Catalogue of typographic spec cards */}
      <section id="drop" className="axk-drop">
        <div className="axk-secthead">
          <h2 className="axk-h2">Drop 001</h2>
          <p>Four pieces. One run. No restock.</p>
        </div>
        <ul className="axk-items">
          {drop.map((item) => (
            <li className="axk-item" key={item.no}>
              <div className="axk-item__row">
                <span className="axk-item__no">{item.no}</span>
                <span className="axk-item__price">${item.price}</span>
              </div>
              <h3 className="axk-item__name">{item.name}</h3>
              <p className="axk-item__spec">{item.spec}</p>
              <div className="axk-item__foot">
                <div className="axk-ways" aria-label="Colourways">
                  {item.ways.map((c, i) => (
                    <span key={i} className="axk-way" style={{ background: c }} />
                  ))}
                </div>
                <button className="axk-additem" type="button">Add to bag</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Lookbook — Split Studio reversed, caution-stripe art panel */}
      <section id="lookbook" className="axk-look">
        <div className="axk-look__art axk-stripes" aria-hidden="true">
          <span className="axk-look__num">SS26</span>
        </div>
        <div className="axk-look__copy">
          <p className="axk-kicker">The Lookbook</p>
          <h2 className="axk-h2">Worn in, not worn&nbsp;out.</h2>
          <p>
            Every piece is shot on real people in real streets — because
            that&rsquo;s where it lives. The full editorial shows how the
            collection layers, from base tee to outer fleece.
          </p>
          <a href="#" className="axk-btn axk-btn--ghost">Open the full lookbook</a>
        </div>
      </section>

      {/* Story — centred statement */}
      <section id="story" className="axk-story">
        <p className="axk-kicker">The Story</p>
        <p className="axk-statement">
          Alexceeper started with one rule: make the thing you&rsquo;d actually
          wear every day. Small runs, high quality, quiet logo — so the gear
          does the talking.
        </p>
      </section>

      {/* Newsletter CTA */}
      <section className="axk-cta">
        <div>
          <h2 className="axk-h2">First access to Drop&nbsp;002.</h2>
          <p>Early links before it sells out. No spam.</p>
        </div>
        <div className="axk-form">
          <input type="email" placeholder="you@email.com" aria-label="Email address" />
          <button className="axk-btn" type="button">Notify me</button>
        </div>
      </section>

      {/* Ft5 statement footer */}
      <footer className="axk-footer">
        <p className="axk-footer__statement">Keep going.</p>
        <div className="axk-footer__row">
          <span className="axk-word axk-word--sm">ALEXCEEPER</span>
          <span>© {new Date().getFullYear()} · Concept mockup by NunezDev</span>
        </div>
      </footer>
    </main>
  );
}

const css = `
.axk {
  --axk-paper: oklch(17% 0.006 75);
  --axk-paper-2: oklch(21% 0.008 75);
  --axk-paper-3: oklch(26% 0.009 75);
  --axk-ink: oklch(95% 0.008 85);
  --axk-muted: oklch(71% 0.012 80);
  --axk-line: oklch(32% 0.008 75);
  --axk-accent: oklch(87% 0.185 124);
  --axk-accent-press: oklch(80% 0.185 124);
  --axk-accent-ink: oklch(24% 0.06 124);
  --axk-display: var(--font-archivo), system-ui, sans-serif;
  --axk-body: var(--font-space-grotesk), system-ui, sans-serif;
  --axk-mono: var(--font-geist-mono), ui-monospace, monospace;
  --axk-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --axk-wrap: min(1160px, calc(100% - 3rem));
  background: var(--axk-paper);
  color: var(--axk-ink);
  font-family: var(--axk-body);
  overflow-x: clip;
  -webkit-font-smoothing: antialiased;
}
.axk *, .axk *::before, .axk *::after { box-sizing: border-box; }
.axk h1, .axk h2, .axk h3 {
  font-family: var(--axk-display);
  font-weight: 900; letter-spacing: -0.025em; line-height: 0.95; margin: 0;
  overflow-wrap: anywhere; min-width: 0; text-wrap: balance;
}
.axk p { margin: 0; }
.axk a { color: inherit; text-decoration: none; }
.axk ul { list-style: none; margin: 0; padding: 0; }

/* Ribbon */
.axk-ribbon {
  display: flex; gap: 0.5rem 1.4rem; justify-content: center; align-items: center;
  flex-wrap: wrap; padding: 0.55rem 1.25rem; font-size: 0.78rem;
  font-family: var(--axk-mono); letter-spacing: 0.02em;
  background: var(--axk-accent); color: var(--axk-accent-ink); font-weight: 500;
}
.axk-ribbon strong { font-weight: 700; }
.axk-ribbon a { text-decoration: underline; text-underline-offset: 3px; transition: opacity 0.16s var(--axk-ease); }
.axk-ribbon a:hover { opacity: 0.7; }
.axk-ribbon a:focus-visible { outline: 2px solid var(--axk-accent-ink); outline-offset: 3px; }

/* Wordmark */
.axk-word { font-family: var(--axk-display); font-weight: 900; letter-spacing: 0.04em; font-size: 1.15rem; }
.axk-word--sm { font-size: 1rem; }

/* Masthead nav (N6) */
.axk-mast {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  width: 100%; padding: 1rem clamp(1.25rem, 4vw, 2.5rem);
  border-bottom: 1px solid var(--axk-line);
  background: color-mix(in oklab, var(--axk-paper) 86%, transparent);
  backdrop-filter: blur(10px);
}
.axk-mast__nav { display: flex; align-items: center; gap: clamp(1rem, 2.6vw, 2rem); font-size: 0.9rem; color: var(--axk-muted); }
.axk-mast__nav > a { transition: color 0.16s var(--axk-ease); white-space: nowrap; }
.axk-mast__nav > a:hover { color: var(--axk-ink); }
.axk-mast__nav > a:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 4px; color: var(--axk-ink); }

/* Buttons */
.axk-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.6rem; border-radius: 2px; border: 1px solid transparent;
  background: var(--axk-accent); color: var(--axk-accent-ink);
  font-family: var(--axk-body); font-weight: 700; font-size: 0.92rem; white-space: nowrap; cursor: pointer;
  transition: transform 0.14s var(--axk-ease), background-color 0.14s var(--axk-ease);
}
.axk-btn:hover { background: var(--axk-accent-press); transform: translateY(-2px); }
.axk-btn:active { transform: translateY(0); }
.axk-btn:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 3px; }
.axk-btn--sm { padding: 0.5rem 1rem; font-size: 0.82rem; }
.axk-btn--ghost { background: transparent; color: var(--axk-ink); border-color: var(--axk-line); }
.axk-btn--ghost:hover { background: var(--axk-paper-2); border-color: var(--axk-muted); }

/* Shared bits */
.axk-kicker { font-family: var(--axk-mono); text-transform: uppercase; letter-spacing: 0.16em; font-size: 0.72rem; color: var(--axk-accent); margin-bottom: 1.2rem; }
.axk-h1 { font-size: clamp(2.7rem, 8.2vw, 5.6rem); }
.axk-h2 { font-size: clamp(1.9rem, 4.4vw, 3.1rem); }
.axk-lede { margin-top: 1.4rem; max-width: 42ch; color: var(--axk-muted); font-size: clamp(1rem, 1.5vw, 1.15rem); line-height: 1.6; }

/* Hero diptych */
.axk-hero {
  width: var(--axk-wrap); margin: clamp(2.5rem, 6vw, 4.5rem) auto clamp(2rem, 5vw, 3.5rem);
  display: grid; grid-template-columns: 1.12fr 0.88fr; gap: clamp(1.5rem, 4vw, 3.5rem); align-items: center;
  animation: axk-rise 0.6s var(--axk-ease) both;
}
.axk-hero__cta { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 2rem; }
.axk-hero__art { display: flex; justify-content: center; }
.axk-emblem {
  position: relative; width: min(340px, 78vw); aspect-ratio: 1; border: 1px solid var(--axk-line);
  background: var(--axk-paper-2); display: grid; place-items: center; border-radius: 3px;
}
.axk-emblem__ring { position: absolute; width: 62%; aspect-ratio: 1; border: 1px solid var(--axk-line); border-radius: 50%; }
.axk-emblem__ring--2 { width: 84%; border-style: dashed; border-color: color-mix(in oklab, var(--axk-accent) 60%, var(--axk-line)); }
.axk-emblem__mark { font-family: var(--axk-display); font-weight: 900; font-size: clamp(3.5rem, 12vw, 6rem); letter-spacing: -0.04em; color: var(--axk-accent); }
.axk-emblem__tag { position: absolute; bottom: 9%; font-family: var(--axk-mono); font-size: 0.66rem; letter-spacing: 0.42em; color: var(--axk-muted); text-indent: 0.42em; }

/* Type band */
.axk-band {
  display: flex; align-items: center; gap: 1.4rem; justify-content: center;
  border-block: 1px solid var(--axk-line); padding: 0.9rem 1rem; overflow: hidden;
  font-family: var(--axk-display); font-weight: 900; letter-spacing: 0.02em;
  font-size: clamp(1.4rem, 4.5vw, 2.6rem); color: var(--axk-paper-3);
}
.axk-band__dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--axk-accent); flex: none; }

/* Drop */
.axk-drop { width: var(--axk-wrap); margin: clamp(3rem, 8vw, 6rem) auto; }
.axk-secthead { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem 1rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--axk-line); }
.axk-secthead p { color: var(--axk-muted); font-family: var(--axk-mono); font-size: 0.8rem; }
.axk-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.axk-item {
  display: flex; flex-direction: column; padding: clamp(1.6rem, 3vw, 2.4rem) clamp(1.4rem, 3vw, 2.2rem);
  border-bottom: 1px solid var(--axk-line);
}
.axk-item:nth-child(odd) { border-right: 1px solid var(--axk-line); }
.axk-item__row { display: flex; justify-content: space-between; align-items: baseline; font-family: var(--axk-mono); color: var(--axk-muted); font-size: 0.82rem; }
.axk-item__price { color: var(--axk-ink); font-variant-numeric: tabular-nums; }
.axk-item__name { font-size: clamp(1.4rem, 3vw, 2rem); margin-top: 0.9rem; }
.axk-item__spec { color: var(--axk-muted); font-size: 0.9rem; margin-top: 0.4rem; }
.axk-item__foot { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.6rem; }
.axk-ways { display: flex; gap: 0.45rem; }
.axk-way { width: 1.05rem; height: 1.05rem; border-radius: 50%; border: 1px solid color-mix(in oklab, var(--axk-ink) 22%, transparent); }
.axk-additem {
  font-family: var(--axk-body); font-weight: 600; font-size: 0.85rem; color: var(--axk-ink);
  background: none; border: 0; padding: 0.3rem 0; cursor: pointer; position: relative;
}
.axk-additem::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: var(--axk-accent); transform: scaleX(0); transform-origin: left; transition: transform 0.2s var(--axk-ease); }
.axk-additem:hover::after, .axk-additem:focus-visible::after { transform: scaleX(1); }
.axk-additem:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 3px; }

/* Lookbook diptych */
.axk-look { width: var(--axk-wrap); margin: clamp(3rem, 8vw, 6rem) auto; display: grid; grid-template-columns: 0.9fr 1.1fr; gap: clamp(1.5rem, 4vw, 3.5rem); align-items: center; }
.axk-look__art { position: relative; aspect-ratio: 4 / 5; border: 1px solid var(--axk-line); border-radius: 3px; overflow: hidden; display: grid; place-items: end start; }
.axk-stripes { background-image: repeating-linear-gradient(-45deg, var(--axk-paper-2) 0 26px, var(--axk-paper) 26px 52px); }
.axk-look__num { margin: 1.1rem 1.3rem; font-family: var(--axk-mono); font-size: 0.8rem; letter-spacing: 0.3em; color: var(--axk-ink); background: var(--axk-accent); color: var(--axk-accent-ink); padding: 0.3rem 0.6rem; border-radius: 2px; }
.axk-look__copy .axk-h2 { margin-bottom: 1.1rem; }
.axk-look__copy p { color: var(--axk-muted); line-height: 1.65; max-width: 40ch; margin-bottom: 1.7rem; }

/* Story */
.axk-story { width: var(--axk-wrap); max-width: 900px; margin: clamp(3.5rem, 9vw, 7rem) auto; text-align: center; }
.axk-story .axk-kicker { margin-bottom: 0.6rem; }
.axk-statement { font-family: var(--axk-display); font-weight: 500; font-size: clamp(1.5rem, 3.8vw, 2.7rem); line-height: 1.22; letter-spacing: -0.015em; max-width: 22ch; margin: 0 auto; }

/* CTA */
.axk-cta {
  width: var(--axk-wrap); margin: clamp(3rem, 8vw, 6rem) auto;
  border: 1px solid var(--axk-line); border-radius: 4px; padding: clamp(1.8rem, 5vw, 3.2rem);
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.6rem;
}
.axk-cta .axk-h2 { max-width: 16ch; }
.axk-cta p { color: var(--axk-muted); margin-top: 0.6rem; }
.axk-form { display: flex; gap: 0.6rem; flex: 1 1 20rem; max-width: 30rem; }
.axk-form input { flex: 1 1 auto; min-width: 0; padding: 0.85rem 1.1rem; border-radius: 2px; border: 1px solid var(--axk-line); background: var(--axk-paper); color: var(--axk-ink); font-family: var(--axk-body); font-size: 0.95rem; }
.axk-form input::placeholder { color: var(--axk-muted); }
.axk-form input:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 2px; border-color: transparent; }

/* Footer */
.axk-footer { border-top: 1px solid var(--axk-line); padding: clamp(2.5rem, 6vw, 4rem) clamp(1.25rem, 4vw, 2.5rem) 2.5rem; }
.axk-footer__statement { font-family: var(--axk-display); font-weight: 900; font-size: clamp(2.4rem, 9vw, 5rem); letter-spacing: -0.03em; line-height: 0.9; color: var(--axk-paper-3); }
.axk-footer__row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem; margin-top: 2rem; padding-top: 1.4rem; border-top: 1px solid var(--axk-line); color: var(--axk-muted); font-family: var(--axk-mono); font-size: 0.78rem; }

@keyframes axk-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

/* Responsive */
@media (max-width: 860px) {
  .axk-hero { grid-template-columns: 1fr; }
  .axk-hero__art { order: -1; }
  .axk-emblem { width: min(280px, 66vw); }
  .axk-look { grid-template-columns: 1fr; }
  .axk-look__art { aspect-ratio: 16 / 10; }
}
@media (max-width: 560px) {
  .axk-mast__nav > a:not(.axk-btn) { display: none; }
  .axk-items { grid-template-columns: 1fr; }
  .axk-item:nth-child(odd) { border-right: 0; }
  .axk-cta { flex-direction: column; align-items: stretch; }
}
@media (prefers-reduced-motion: reduce) {
  .axk-hero { animation: none; }
  .axk-btn:hover { transform: none; }
  .axk-additem::after { transition: none; }
}
`;
