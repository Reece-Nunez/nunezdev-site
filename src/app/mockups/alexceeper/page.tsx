/* Hallmark · macrostructure: Marquee Hero · tone: playful-streetwear · anchor hue: volt-lime
 * Concept mockup for the lead "Alexceeper" (merch brand). Self-contained, scoped
 * under `.axk` so the global Space Grotesk/Lora rules don't leak in. noindex —
 * this is a client demo, not real site content. */
import type { Metadata } from "next";
import { Archivo } from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alexceeper — Concept Mockup",
  description: "A concept storefront mockup built by NunezDev for Alexceeper.",
  robots: { index: false, follow: false },
  alternates: { canonical: undefined },
};

const drop = [
  { name: "Voyager Hoodie", tag: "Heavyweight fleece", price: "$68" },
  { name: "Signal Tee", tag: "Boxed cotton", price: "$34" },
  { name: "Grid Cap", tag: "Structured 6-panel", price: "$28" },
  { name: "Static Crewneck", tag: "Brushed loopback", price: "$58" },
];

export default function AlexceeperMockup() {
  return (
    <main className={`${archivo.variable} axk`}>
      <style>{css}</style>

      {/* Demo attribution — makes clear this is a concept, keeps NunezDev on it */}
      <div className="axk-ribbon">
        <span>Concept mockup for <strong>Alexceeper</strong></span>
        <a href="https://www.nunezdev.com" target="_blank" rel="noreferrer">
          built by NunezDev →
        </a>
      </div>

      {/* Floating pill nav (N5) */}
      <header className="axk-nav">
        <a href="#top" className="axk-mark">ALEXCEEPER</a>
        <nav className="axk-links">
          <a href="#drop">Drop 001</a>
          <a href="#lookbook">Lookbook</a>
          <a href="#ethos">Story</a>
        </nav>
        <a href="#drop" className="axk-btn axk-btn--sm">Shop</a>
      </header>

      {/* Marquee hero */}
      <section id="top" className="axk-hero">
        <div className="axk-marquee" aria-hidden="true">
          <div className="axk-marquee__track">
            <span>ALEXCEEPER — KEEP GOING — </span>
            <span>ALEXCEEPER — KEEP GOING — </span>
            <span>ALEXCEEPER — KEEP GOING — </span>
          </div>
        </div>
        <div className="axk-hero__inner">
          <p className="axk-eyebrow">Drop 001 · Now live</p>
          <h1 className="axk-h1">Gear for people who keep&nbsp;going.</h1>
          <p className="axk-lede">
            Heavyweight essentials, built to outlast the hype. No restocks, no
            filler — just the pieces that earn a place in the rotation.
          </p>
          <div className="axk-hero__cta">
            <a href="#drop" className="axk-btn">Shop the drop</a>
            <a href="#lookbook" className="axk-btn axk-btn--ghost">See the lookbook</a>
          </div>
        </div>
      </section>

      {/* Drop grid */}
      <section id="drop" className="axk-section">
        <div className="axk-head">
          <h2 className="axk-h2">Drop 001</h2>
          <p>Four pieces. Made in a single run.</p>
        </div>
        <div className="axk-grid">
          {drop.map((item, i) => (
            <article className="axk-card" key={item.name}>
              <div className={`axk-card__art axk-card__art--${i + 1}`}>
                <span className="axk-card__badge">0{i + 1}</span>
              </div>
              <div className="axk-card__meta">
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.tag}</p>
                </div>
                <span className="axk-price">{item.price}</span>
              </div>
              <button className="axk-btn axk-btn--full" type="button">Add to bag</button>
            </article>
          ))}
        </div>
      </section>

      {/* Lookbook split */}
      <section id="lookbook" className="axk-look">
        <div className="axk-look__art" aria-hidden="true" />
        <div className="axk-look__copy">
          <p className="axk-eyebrow">The Lookbook</p>
          <h2 className="axk-h2">Worn in, not worn out.</h2>
          <p>
            Every piece is photographed on real people in real streets — because
            that&apos;s where it lives. Scroll the full editorial and see how the
            collection layers.
          </p>
          <a href="#" className="axk-btn axk-btn--ghost">Open the full lookbook</a>
        </div>
      </section>

      {/* Ethos */}
      <section id="ethos" className="axk-ethos">
        <p className="axk-eyebrow">The Story</p>
        <p className="axk-statement">
          Alexceeper started with one rule: make the thing you&apos;d actually
          wear every day. We keep runs small, quality high, and the logo quiet —
          so the gear does the talking.
        </p>
      </section>

      {/* Newsletter CTA */}
      <section className="axk-cta">
        <h2 className="axk-h2">Get first access to Drop 002.</h2>
        <p>No spam. Just early links before they sell out.</p>
        <div className="axk-form">
          <input type="email" placeholder="you@email.com" aria-label="Email address" />
          <button className="axk-btn" type="button">Notify me</button>
        </div>
      </section>

      <footer className="axk-footer">
        <span className="axk-mark axk-mark--sm">ALEXCEEPER</span>
        <p>Keep going. © {new Date().getFullYear()} Alexceeper. Concept mockup.</p>
      </footer>
    </main>
  );
}

const css = `
.axk {
  --axk-paper: oklch(16% 0.012 265);
  --axk-paper-2: oklch(21% 0.014 265);
  --axk-line: oklch(31% 0.012 265);
  --axk-ink: oklch(96% 0.005 250);
  --axk-muted: oklch(72% 0.012 260);
  --axk-accent: oklch(87% 0.19 128);
  --axk-accent-2: oklch(78% 0.19 128);
  --axk-accent-ink: oklch(22% 0.06 130);
  --axk-body: var(--font-space-grotesk), system-ui, sans-serif;
  --axk-ease: cubic-bezier(0.4, 0, 0.2, 1);
  background: var(--axk-paper);
  color: var(--axk-ink);
  font-family: var(--axk-body);
  overflow-x: clip;
  -webkit-font-smoothing: antialiased;
}
.axk *, .axk *::before, .axk *::after { box-sizing: border-box; }
.axk h1, .axk h2, .axk h3 {
  font-family: var(--font-archivo, var(--axk-display));
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 0.95;
  margin: 0;
  overflow-wrap: anywhere;
  min-width: 0;
}
.axk p { margin: 0; }
.axk a { color: inherit; text-decoration: none; }

/* Ribbon */
.axk-ribbon {
  display: flex; gap: 1rem; justify-content: center; align-items: center;
  flex-wrap: wrap;
  padding: 0.55rem 1rem; font-size: 0.8rem; letter-spacing: 0.01em;
  background: var(--axk-accent); color: var(--axk-accent-ink);
  font-weight: 600;
}
.axk-ribbon a { text-decoration: underline; text-underline-offset: 2px; }
.axk-ribbon a:hover { opacity: 0.72; }

/* Nav */
.axk-nav {
  position: sticky; top: 0.75rem; z-index: 20;
  width: min(1120px, calc(100% - 1.5rem));
  margin: 0.75rem auto 0;
  display: flex; align-items: center; gap: 1rem;
  padding: 0.6rem 0.7rem 0.6rem 1.25rem;
  background: color-mix(in oklab, var(--axk-paper-2) 82%, transparent);
  border: 1px solid var(--axk-line);
  border-radius: 999px;
  backdrop-filter: blur(12px);
}
.axk-mark { font-family: var(--font-archivo, var(--axk-display)); font-weight: 900; letter-spacing: 0.02em; font-size: 1.05rem; }
.axk-links { display: flex; gap: 1.4rem; margin-left: auto; font-size: 0.9rem; color: var(--axk-muted); }
.axk-links a { transition: color 0.18s var(--axk-ease); white-space: nowrap; }
.axk-links a:hover { color: var(--axk-ink); }

/* Buttons */
.axk-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 0.85rem 1.5rem; border-radius: 999px; border: 1px solid transparent;
  background: var(--axk-accent); color: var(--axk-accent-ink);
  font-family: var(--axk-body); font-weight: 700; font-size: 0.95rem;
  cursor: pointer; white-space: nowrap;
  transition: transform 0.16s var(--axk-ease), background 0.16s var(--axk-ease);
}
.axk-btn:hover { background: var(--axk-accent-2); transform: translateY(-2px); }
.axk-btn:active { transform: translateY(0); }
.axk-btn:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 3px; }
.axk-btn--sm { padding: 0.55rem 1.1rem; font-size: 0.85rem; }
.axk-btn--full { width: 100%; margin-top: 0.9rem; }
.axk-btn--ghost { background: transparent; color: var(--axk-ink); border-color: var(--axk-line); }
.axk-btn--ghost:hover { background: var(--axk-paper-2); border-color: var(--axk-muted); }

/* Hero */
.axk-hero { position: relative; padding: clamp(3rem, 8vw, 6rem) 0 clamp(3rem, 7vw, 5rem); }
.axk-marquee { overflow: hidden; border-block: 1px solid var(--axk-line); padding: 0.6rem 0; margin-bottom: clamp(2.5rem, 6vw, 4rem); }
.axk-marquee__track {
  display: inline-flex; white-space: nowrap; will-change: transform;
  font-family: var(--font-archivo, var(--axk-display)); font-weight: 800;
  font-size: clamp(1.2rem, 3vw, 2rem); color: var(--axk-muted); letter-spacing: 0.04em;
  animation: axk-scroll 22s linear infinite;
}
.axk-marquee__track span { padding-right: 1rem; }
@keyframes axk-scroll { from { transform: translateX(0); } to { transform: translateX(-33.33%); } }
.axk-hero__inner { width: min(1120px, calc(100% - 2.5rem)); margin: 0 auto; max-width: 60rem; }
.axk-eyebrow { text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.75rem; color: var(--axk-accent); font-weight: 600; margin-bottom: 1.1rem; }
.axk-h1 { font-size: clamp(2.6rem, 8vw, 5.6rem); max-width: 14ch; }
.axk-lede { margin-top: 1.4rem; max-width: 46ch; color: var(--axk-muted); font-size: clamp(1rem, 1.6vw, 1.15rem); line-height: 1.6; }
.axk-hero__cta { display: flex; flex-wrap: wrap; gap: 0.8rem; margin-top: 2rem; }

/* Section shell */
.axk-section { width: min(1120px, calc(100% - 2.5rem)); margin: clamp(3rem, 8vw, 6rem) auto; }
.axk-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 1px solid var(--axk-line); padding-bottom: 1.2rem; }
.axk-head .axk-h2 { font-size: clamp(1.8rem, 4vw, 3rem); }
.axk-head p { color: var(--axk-muted); }

/* Drop grid */
.axk-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1.2rem; }
.axk-card { display: flex; flex-direction: column; }
.axk-card__art { position: relative; aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; border: 1px solid var(--axk-line); transition: transform 0.22s var(--axk-ease), border-color 0.22s var(--axk-ease); }
.axk-card:hover .axk-card__art { transform: translateY(-4px); border-color: var(--axk-muted); }
.axk-card__art--1 { background: linear-gradient(150deg, oklch(30% 0.02 265), oklch(19% 0.02 265)); }
.axk-card__art--2 { background: linear-gradient(150deg, var(--axk-accent), oklch(60% 0.15 128)); }
.axk-card__art--3 { background: linear-gradient(150deg, oklch(34% 0.03 260), oklch(20% 0.02 300)); }
.axk-card__art--4 { background: linear-gradient(150deg, oklch(40% 0.02 90), oklch(22% 0.02 265)); }
.axk-card__badge { position: absolute; top: 0.7rem; left: 0.8rem; font-family: var(--font-archivo, var(--axk-display)); font-weight: 900; font-size: 1.1rem; mix-blend-mode: overlay; opacity: 0.85; }
.axk-card__meta { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-top: 0.9rem; }
.axk-card__meta h3 { font-size: 1.05rem; font-weight: 800; }
.axk-card__meta p { color: var(--axk-muted); font-size: 0.85rem; margin-top: 0.15rem; }
.axk-price { font-family: var(--font-archivo, var(--axk-display)); font-weight: 800; font-size: 1rem; }

/* Lookbook */
.axk-look { width: min(1120px, calc(100% - 2.5rem)); margin: clamp(3rem, 8vw, 6rem) auto; display: grid; grid-template-columns: 1fr 1fr; gap: clamp(1.5rem, 4vw, 3rem); align-items: center; }
.axk-look__art { aspect-ratio: 5 / 6; border-radius: 18px; border: 1px solid var(--axk-line); background: radial-gradient(120% 90% at 20% 15%, oklch(30% 0.04 128), var(--axk-paper-2) 60%); }
.axk-look__copy .axk-h2 { font-size: clamp(1.8rem, 4vw, 3.2rem); margin-bottom: 1.1rem; }
.axk-look__copy p { color: var(--axk-muted); line-height: 1.65; max-width: 42ch; margin-bottom: 1.6rem; }

/* Ethos */
.axk-ethos { width: min(1120px, calc(100% - 2.5rem)); margin: clamp(3.5rem, 9vw, 7rem) auto; text-align: center; }
.axk-statement { font-family: var(--font-archivo, var(--axk-display)); font-weight: 600; font-size: clamp(1.5rem, 3.6vw, 2.7rem); line-height: 1.2; letter-spacing: -0.01em; max-width: 24ch; margin: 1.2rem auto 0; }
.axk-ethos .axk-eyebrow { margin-bottom: 0; }

/* CTA */
.axk-cta { width: min(1120px, calc(100% - 2.5rem)); margin: clamp(3rem, 8vw, 6rem) auto; background: var(--axk-paper-2); border: 1px solid var(--axk-line); border-radius: 22px; padding: clamp(2rem, 6vw, 4rem); text-align: center; }
.axk-cta .axk-h2 { font-size: clamp(1.7rem, 4vw, 3rem); max-width: 18ch; margin: 0 auto; }
.axk-cta > p { color: var(--axk-muted); margin-top: 0.8rem; }
.axk-form { display: flex; flex-wrap: wrap; gap: 0.7rem; justify-content: center; margin-top: 1.8rem; }
.axk-form input { flex: 1 1 16rem; max-width: 22rem; padding: 0.85rem 1.2rem; border-radius: 999px; border: 1px solid var(--axk-line); background: var(--axk-paper); color: var(--axk-ink); font-family: var(--axk-body); font-size: 0.95rem; }
.axk-form input::placeholder { color: var(--axk-muted); }
.axk-form input:focus-visible { outline: 2px solid var(--axk-accent); outline-offset: 2px; border-color: transparent; }

/* Footer */
.axk-footer { border-top: 1px solid var(--axk-line); padding: 2.5rem 1.25rem; text-align: center; display: flex; flex-direction: column; gap: 0.6rem; align-items: center; }
.axk-mark--sm { font-size: 1.3rem; }
.axk-footer p { color: var(--axk-muted); font-size: 0.85rem; }

/* Responsive */
@media (max-width: 900px) {
  .axk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .axk-look { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .axk-links { display: none; }
  .axk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.8rem; }
}
@media (prefers-reduced-motion: reduce) {
  .axk-marquee__track { animation: none; }
  .axk-btn:hover, .axk-card:hover .axk-card__art { transform: none; }
}
`;
