import type { Metadata } from "next";

// One-off, hand-built pitch proposal for Legacy Training & Consulting (Maria Roman).
// This is NOT the DB-driven /proposal/[token] flow. It's a bespoke marketing
// document, so it ships as a static route. ChromeGate already hides the site
// Navbar/Footer for any /proposal/* path, giving it a focused, standalone feel.
// All styles are scoped under `.ltcp` so nothing leaks into the rest of the site.

export const metadata: Metadata = {
  title: "Website Proposal · Legacy Training & Consulting",
  description: "Website proposal prepared by NunezDev for Legacy Training & Consulting.",
  robots: { index: false, follow: false },
};

const CSS = String.raw`/* Hallmark · macrostructure: Long Document · tone: professional/personable (Reece's voice) · anchor hue: brand yellow #ffc312
 * Genre: modern-minimal (B2B professional services). Component-scope: single proposal doc.
 * Fixed dark-panel tokens (--panel*) never theme-flip; --navy stays a flipping text/link token.
 * pre-emit critique: P5 H5 E4 S5 R5 V4 */
.ltcp { --paper: #fbf8f3;
  --paper-2: #ffffff;
  --paper-3: #f3ece1;
  --ink: #14161a;
  --ink-2: #43474e;
  --ink-3: #74787f;
  --line: #e5ddd0;
  --line-2: #d8cfbf;
  --navy: #0b2a4a;
  --brand: #ffc312;
  --brand-ink: #111111;
  --brand-deep: #b8850a;
  --good: #1f7a4d;

  /* Fixed dark panel, same in light + dark so the banner never washes out */
  --panel: #17191e;
  --panel-2: #1e2128;
  --panel-fg: #ffffff;
  --panel-sub: #cbced4;
  --panel-dim: #8b8f97;
  --panel-line: rgba(255,255,255,.14);

  --shadow: 0 1px 2px rgba(20,22,26,.05), 0 10px 30px -18px rgba(20,22,26,.25);
  --radius: 14px;
  --radius-sm: 9px;
  --measure: 68ch;

  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  --font-mono: "SF Mono", "Cascadia Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace; }
@media (prefers-color-scheme: dark) {
  .ltcp { --paper: #0e1013;
    --paper-2: #16191e;
    --paper-3: #1c2026;
    --ink: #f3f0ea;
    --ink-2: #b9bcc2;
    --ink-3: #878b93;
    --line: #262b32;
    --line-2: #313842;
    --navy: #4f93da;
    --brand-deep: #ffd451;
    --good: #4cc98a;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 18px 40px -22px rgba(0,0,0,.7); }
}
.ltcp[data-theme="light"] { --paper: #fbf8f3; --paper-2: #ffffff; --paper-3: #f3ece1;
  --ink: #14161a; --ink-2: #43474e; --ink-3: #74787f;
  --line: #e5ddd0; --line-2: #d8cfbf; --navy: #0b2a4a;
  --brand-deep: #b8850a; --good: #1f7a4d;
  --shadow: 0 1px 2px rgba(20,22,26,.05), 0 10px 30px -18px rgba(20,22,26,.25); }
.ltcp[data-theme="dark"] { --paper: #0e1013; --paper-2: #16191e; --paper-3: #1c2026;
  --ink: #f3f0ea; --ink-2: #b9bcc2; --ink-3: #878b93;
  --line: #262b32; --line-2: #313842; --navy: #4f93da;
  --brand-deep: #ffd451; --good: #4cc98a;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 18px 40px -22px rgba(0,0,0,.7); }
.ltcp, .ltcp * { box-sizing: border-box; }
.ltcp { overflow-x: clip; }
.ltcp { margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 16.5px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility; min-height: 100vh; }
.ltcp .wrap { max-width: 940px; margin: 0 auto; padding: 0 22px; }
.ltcp .doc { max-width: 940px; margin: 0 auto; padding: 0 22px 100px; }
.ltcp h1, .ltcp h2, .ltcp h3 { line-height: 1.12; letter-spacing: -.018em; overflow-wrap: anywhere; text-wrap: balance; }
.ltcp p { max-width: var(--measure); }
.ltcp a { color: var(--navy); }
.ltcp .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--brand-deep); margin: 0; }
.ltcp .rule { height: 1px; background: var(--line); border: 0; margin: 0; }
/* ---------- Masthead (fixed dark panel) ---------- */
.ltcp .mast { background: var(--panel);
  color: var(--panel-fg);
  border-bottom: 4px solid var(--brand); }
.ltcp .mast .wrap { padding-top: 30px; padding-bottom: 34px; }
.ltcp .mast-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ltcp .brandmark { display: flex; align-items: center; gap: 11px; font-weight: 800; letter-spacing: -.02em; font-size: 20px; color: var(--panel-fg); }
.ltcp .brandmark .logo { height: 34px; width: auto; display: block; }
.ltcp .mast-meta { text-align: right; font-size: 12.5px; color: var(--panel-dim); line-height: 1.5; }
.ltcp .mast h1 { font-size: clamp(30px, 6vw, 50px); margin: 30px 0 0; color: var(--panel-fg); font-weight: 800; max-width: 15ch; }
.ltcp .mast .sub { margin: 14px 0 0; color: var(--panel-sub); font-size: 17px; max-width: 60ch; }
.ltcp .prepared { margin-top: 26px; display: flex; gap: 34px 46px; flex-wrap: wrap;
  border-top: 1px solid var(--panel-line); padding-top: 20px; }
.ltcp .prepared div { min-width: 0; }
.ltcp .prepared .k { font-size: 11px; letter-spacing: .13em; text-transform: uppercase; color: var(--panel-dim); margin: 0 0 3px; }
.ltcp .prepared .v { font-size: 15px; color: var(--panel-fg); margin: 0; font-weight: 600; }
/* ---------- Sections ---------- */
.ltcp section { padding-top: 56px; }
.ltcp .sec-head { margin-bottom: 22px; }
.ltcp .sec-head h2 { font-size: clamp(22px, 3.6vw, 30px); margin: 8px 0 0; font-weight: 750; }
.ltcp .lead { font-size: 18px; color: var(--ink-2); }
/* Letter */
.ltcp .letter p { margin: 0 0 15px; color: var(--ink-2); font-size: 17px; }
.ltcp .letter .sign { margin-top: 22px; font-weight: 600; color: var(--ink); }
.ltcp .letter .sign span { display: block; color: var(--ink-3); font-weight: 500; font-size: 14px; }
/* Understanding grid */
.ltcp .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.ltcp .card { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 20px 20px; box-shadow: var(--shadow); }
.ltcp .card h3 { font-size: 15px; margin: 0 0 6px; font-weight: 700; }
.ltcp .card p { font-size: 14.5px; color: var(--ink-2); margin: 0; }
.ltcp .pagelist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0 26px; }
.ltcp .pagelist li { padding: 11px 0; border-bottom: 1px solid var(--line); display: flex; gap: 11px; align-items: baseline; }
.ltcp .pagelist .n { font-family: var(--font-mono); font-size: 12px; color: var(--brand-deep); font-weight: 700; min-width: 20px; }
.ltcp .pagelist .t { font-weight: 650; font-size: 15px; }
.ltcp .pagelist .d { color: var(--ink-3); font-size: 13.5px; display: block; }
/* Options */
.ltcp .options { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 18px; align-items: start; }
.ltcp .opt { position: relative; background: var(--paper-2); border: 1px solid var(--line);
  border-radius: var(--radius); padding: 26px 24px 24px; box-shadow: var(--shadow);
  display: flex; flex-direction: column; }
.ltcp .opt.reco { border-color: var(--brand); border-width: 1.5px; }
.ltcp .opt .tag { position: absolute; top: -12px; left: 24px; background: var(--brand); color: var(--brand-ink);
  font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase;
  padding: 5px 11px; border-radius: 999px; }
.ltcp .opt .optk { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--ink-3); margin: 0; }
.ltcp .opt h3 { font-size: 21px; margin: 7px 0 0; font-weight: 780; }
.ltcp .opt .blurb { font-size: 14px; color: var(--ink-2); margin: 9px 0 0; min-height: 60px; }
.ltcp .price { display: flex; align-items: baseline; gap: 8px; margin: 16px 0 2px; }
.ltcp .price .amt { font-size: 34px; font-weight: 820; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.ltcp .price .per { font-size: 13px; color: var(--ink-3); }
.ltcp .price-note { font-size: 12.5px; color: var(--ink-3); margin: 0 0 16px; }
.ltcp .feat { list-style: none; margin: 0; padding: 16px 0 0; border-top: 1px solid var(--line); display: grid; gap: 9px; }
.ltcp .feat li { display: flex; gap: 9px; font-size: 14px; color: var(--ink-2); align-items: baseline; }
.ltcp .feat li b { color: var(--ink); font-weight: 650; }
.ltcp .check { color: var(--good); font-weight: 800; flex: 0 0 auto; }
.ltcp .best { margin: 15px 0 0; font-size: 13px; color: var(--ink-3); padding-top: 13px; border-top: 1px dashed var(--line-2); }
.ltcp .best b { color: var(--ink); }
/* Included table */
.ltcp .tbl { width: 100%; border-collapse: collapse; font-size: 14.5px; }
.ltcp .tbl-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper-2); box-shadow: var(--shadow); }
.ltcp .tbl th, .ltcp .tbl td { text-align: left; padding: 13px 16px; border-bottom: 1px solid var(--line); }
.ltcp .tbl thead th { background: var(--paper-3); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); font-weight: 700; white-space: nowrap; }
.ltcp .tbl tbody tr:last-child td { border-bottom: 0; }
.ltcp .tbl td:first-child { font-weight: 600; color: var(--ink); }
.ltcp .tbl td.c { text-align: center; }
.ltcp .tbl .yes { color: var(--good); font-weight: 800; }
/* Timeline */
.ltcp .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.ltcp .timeline li { display: grid; grid-template-columns: 150px 1fr; gap: 20px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.ltcp .timeline li:last-child { border-bottom: 0; }
.ltcp .timeline .when { font-weight: 700; font-size: 14px; color: var(--navy); }
.ltcp .timeline .when span { display: block; font-weight: 500; color: var(--ink-3); font-size: 12.5px; }
.ltcp .timeline .what b { font-weight: 680; }
.ltcp .timeline .what p { margin: 3px 0 0; font-size: 14px; color: var(--ink-2); }
/* Investment */
.ltcp .invoice { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.ltcp .invoice .row { display: flex; justify-content: space-between; gap: 16px; padding: 15px 22px; border-bottom: 1px solid var(--line); }
.ltcp .invoice .row .lbl b { font-weight: 680; }
.ltcp .invoice .row .lbl span { display: block; color: var(--ink-3); font-size: 13px; }
.ltcp .invoice .row .val { font-weight: 720; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ltcp .invoice .row.total { background: var(--panel); color: var(--panel-fg); border-bottom: 0; }
.ltcp .invoice .row.total .val { font-size: 20px; }
.ltcp .invoice .row.total .lbl span { color: var(--panel-dim); }
.ltcp .addon-note { font-size: 13px; color: var(--ink-3); margin: 14px 2px 0; }
/* Terms + next */
.ltcp .terms { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.ltcp .terms .card p { margin-top: 4px; }
.ltcp .cta { margin-top: 30px; background: var(--panel); color: var(--panel-fg); border-radius: var(--radius);
  padding: 32px 30px; box-shadow: var(--shadow); border-top: 4px solid var(--brand); }
.ltcp .cta h2 { color: var(--panel-fg); font-size: clamp(22px,3.4vw,28px); margin: 0; }
.ltcp .cta p { color: var(--panel-sub); margin: 12px 0 0; max-width: 58ch; }
.ltcp .cta .steps { margin: 20px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.ltcp .cta .steps li { display: flex; gap: 12px; align-items: baseline; color: var(--panel-fg); font-size: 15px; }
.ltcp .cta .steps .num { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 999px; background: var(--brand); color: var(--brand-ink); font-weight: 800; font-size: 13px; display: grid; place-items: center; }
.ltcp .cta .contact { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--panel-line); display: flex; gap: 28px; flex-wrap: wrap; font-size: 14px; }
.ltcp .cta .contact a { color: var(--brand); text-decoration: none; font-weight: 650; }
.ltcp .cta .contact .k { color: var(--panel-dim); display: block; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2px; }
.ltcp .cta .contact .v2 { color: var(--panel-sub); }
.ltcp .foot { margin-top: 42px; text-align: center; color: var(--ink-3); font-size: 12.5px; }
.ltcp .foot b { color: var(--ink-2); }
/* Care & Hosting plans */
.ltcp .plans { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; align-items: start; }
.ltcp .plan { position: relative; background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px 20px 22px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
.ltcp .plan.reco { border-color: var(--brand); border-width: 1.5px; }
.ltcp .plan .tag { position: absolute; top: -12px; left: 20px; background: var(--brand); color: var(--brand-ink); font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; padding: 5px 11px; border-radius: 999px; }
.ltcp .plan .optk { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--ink); margin: 0; }
.ltcp .plan .who { font-size: 13px; color: var(--ink-3); margin: 6px 0 0; min-height: 34px; }
.ltcp .pprice { display: flex; align-items: baseline; gap: 4px; margin: 12px 0 0; }
.ltcp .pprice .amt { font-size: 28px; font-weight: 820; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.ltcp .pprice .per { font-size: 13px; color: var(--ink-3); }
.ltcp .pfeat { list-style: none; margin: 16px 0 0; padding: 15px 0 0; border-top: 1px solid var(--line); display: grid; gap: 9px; }
.ltcp .pfeat li { display: flex; gap: 9px; font-size: 13.5px; color: var(--ink-2); align-items: baseline; }
.ltcp .pfeat li.inc { color: var(--ink); font-weight: 700; font-size: 12.5px; }
@media (max-width: 720px) {
  .ltcp { font-size: 16px; min-height: 100vh; }
  .ltcp .grid2, .ltcp .options, .ltcp .terms, .ltcp .pagelist, .ltcp .plans { grid-template-columns: 1fr; }
  .ltcp .timeline li { grid-template-columns: 1fr; gap: 4px; }
  .ltcp .mast-meta { text-align: left; }
  .ltcp .opt .blurb { min-height: 0; }
}`;

const BODY = String.raw`<header class="mast">
  <div class="wrap">
    <div class="mast-top">
      <div class="brandmark"><img class="logo" src="data:image/png;base64,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" alt="NunezDev logo" /> NunezDev</div>
      <div class="mast-meta">
        Website Proposal · Rev. A<br>
        Prepared July 21, 2026 · Valid 30 days
      </div>
    </div>
    <p class="eyebrow" style="color:var(--brand); margin-top:28px;">Healthcare Training &amp; Consulting Platform</p>
    <h1>A website built to enroll, book, and convert.</h1>
    <p class="sub">A fast, mobile-first platform for your training programs and consulting services, built to show up on Google and turn visitors into real leads.</p>
    <div class="prepared">
      <div>
        <p class="k">Prepared for</p>
        <p class="v">Maria Roman &amp; Team</p>
      </div>
      <div>
        <p class="k">Organization</p>
        <p class="v">Legacy Training &amp; Consulting</p>
      </div>
      <div>
        <p class="k">Prepared by</p>
        <p class="v">Reece Nunez · NunezDev</p>
      </div>
      <div>
        <p class="k">Target launch</p>
        <p class="v">Within 30 days of kickoff</p>
      </div>
    </div>
  </div>
</header>

<main class="doc">

  <section class="letter" style="padding-top:52px;">
    <div class="sec-head"><p class="eyebrow">A quick note</p><h2>Thanks for the detailed brief.</h2></div>
    <p>Maria, you clearly know what you want this platform to do, which makes my job a lot easier. You're building something that has to earn trust the second it loads. Healthcare pros deciding whether to sign up for a course, and organizations deciding whether to bring you in to consult. Both of them size you up fast, so the site has to look sharp and load quick.</p>
    <p>I put together two ways to build it below. Both cover everything in your brief: the full set of pages, a content management system so your team can edit the site yourselves, QuickBooks payments, custom lead forms, Calendly booking, Google Analytics, hosting and SSL, and branded social pages. The real difference is how the site is built under the hood, and what that means for speed, Google ranking, and how easily it grows with you.</p>
    <p>My honest recommendation is the custom coded build. I'm a software engineer, not a plugin installer, so everything gets coded by hand with no bloat. That said, the WordPress option is a strong, budget friendly path too, and I priced both so your team can pick what fits. Let me know what you think.</p>
    <p class="sign">Reece Nunez<span>Founder &amp; Software Engineer, NunezDev</span></p>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">What we're building</p><h2>Your platform, the way I see it</h2></div>
    <p class="lead" style="margin-bottom:22px;">A conversion-focused site with two jobs: fill your training courses and bring in qualified consulting leads.</p>
    <div class="grid2">
      <div class="card"><h3>Training enrollment</h3><p>A sign-up focused showcase for your CPR, First Aid, and compliance courses. Clear schedules, clear buttons, easy registration.</p></div>
      <div class="card"><h3>Consulting leads</h3><p>In-depth service pages for compliance and clinical development, backed by custom lead forms that come straight to you.</p></div>
      <div class="card"><h3>Booked discovery calls</h3><p>Calendly built right into the site, so prospects can book a call without a bunch of back and forth emails.</p></div>
      <div class="card"><h3>Credibility and proof</h3><p>Your mission, certifications, leadership, and student success stories laid out to build trust with clinicians and organizations.</p></div>
    </div>

    <h3 style="font-size:15px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-3); margin:34px 0 4px;">Page architecture</h3>
    <ul class="pagelist">
      <li><span class="n">01</span><span><span class="t">Home</span><span class="d">Hero, value proposition, services overview, primary CTAs</span></span></li>
      <li><span class="n">02</span><span><span class="t">Services</span><span class="d">Consulting, compliance, and clinical development, in depth</span></span></li>
      <li><span class="n">03</span><span><span class="t">About Us</span><span class="d">Mission, vision, values, certifications, leadership</span></span></li>
      <li><span class="n">04</span><span><span class="t">Training Programs</span><span class="d">Sign-up focused course showcase and registration</span></span></li>
      <li><span class="n">05</span><span><span class="t">Discovery Call</span><span class="d">Integrated Calendly scheduling and lead capture</span></span></li>
      <li><span class="n">06</span><span><span class="t">Testimonials</span><span class="d">Student success stories and client reviews</span></span></li>
      <li><span class="n">07</span><span><span class="t">Contact</span><span class="d">Contact form, business hours, social links</span></span></li>
    </ul>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Two ways to build it</p><h2>Choose your foundation</h2></div>
    <div class="options">
      <div class="opt reco">
        <span class="tag">Recommended</span>
        <p class="optk">Option A</p>
        <h3>Custom-Coded Platform</h3>
        <p class="blurb">Coded by hand by a real software engineer. No page builder plugins, no bloat. It is the fastest, most secure, and most search friendly option, and the easiest one to grow as you add programs.</p>
        <div class="price"><span class="amt">$2,950</span><span class="per">one-time build</span></div>
        <p class="price-note">+ Care &amp; Hosting from $35/mo · 50% to start</p>
        <ul class="feat">
          <li><span class="check">✓</span><span>100% unique design, coded by hand, <b>no templates</b></span></li>
          <li><span class="check">✓</span><span>Top-tier <b>page speed</b> for better Google ranking</span></li>
          <li><span class="check">✓</span><span>Simple <b>content editor</b> so you update it yourself</span></li>
          <li><span class="check">✓</span><span>Locked-down security, <b>no plugin vulnerabilities</b></span></li>
          <li><span class="check">✓</span><span>Room to grow into course catalogs and portals</span></li>
        </ul>
        <p class="best"><b>Best if</b> you want the strongest long-term asset and the edge in Google rankings.</p>
      </div>

      <div class="opt">
        <p class="optk">Option B</p>
        <h3>WordPress Platform</h3>
        <p class="blurb">A polished, fully custom design built on WordPress, the most familiar content system out there. Quick to launch and easy for your team to edit day to day, with a big ecosystem behind it.</p>
        <div class="price"><span class="amt">$2,200</span><span class="per">one-time build</span></div>
        <p class="price-note">+ Care &amp; Hosting from $35/mo · 50% to start</p>
        <ul class="feat">
          <li><span class="check">✓</span><span>Custom design, <b>not an off-the-shelf theme</b></span></li>
          <li><span class="check">✓</span><span>Familiar <b>WordPress dashboard</b> for easy editing</span></li>
          <li><span class="check">✓</span><span>Huge plugin ecosystem for future add-ons</span></li>
          <li><span class="check">✓</span><span>Quickest path to launch</span></li>
          <li><span class="check">✓</span><span>Lower entry cost</span></li>
        </ul>
        <p class="best"><b>Best if</b> budget and self-service editing matter most right now.</p>
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Included either way</p><h2>Everything in your brief, in both options</h2></div>
    <div class="tbl-scroll">
      <table class="tbl">
        <thead>
          <tr><th>Deliverable</th><th class="c">Custom-Coded</th><th class="c">WordPress</th></tr>
        </thead>
        <tbody>
          <tr><td>7-page custom design (100% unique)</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Mobile-responsive across all devices</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Content Management System (CMS)</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>QuickBooks payment integration</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Custom lead-capture forms</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Calendly discovery-call booking</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Google Analytics integration</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>SEO-friendly structure and sitemap</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Branded social pages (Facebook, X, YouTube)</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Collaborative copywriting support</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Hosting and SSL certificate</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>Revisions through the build until you're happy</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
          <tr><td>30 days of edits after launch, included</td><td class="c yes">✓</td><td class="c yes">✓</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Getting to launch</p><h2>Timeline to a live site within a month</h2></div>
    <ul class="timeline">
      <li><div class="when">By Fri, Jul 24<span>Week 0</span></div><div class="what"><b>Agreement and deposit</b><p>You pick the option and scope, the 50% deposit clears, and we lock in your kickoff date.</p></div></li>
      <li><div class="when">Mon, Jul 28<span>Week 1</span></div><div class="what"><b>Kickoff and content</b><p>We gather brand assets, work on copy together, and pin down the program details. I map out the sitemap and layout direction.</p></div></li>
      <li><div class="when">Weeks 1 to 2<span>Design and build</span></div><div class="what"><b>Design and development</b><p>You approve the homepage concept, then I build out all seven pages with your feedback as I go.</p></div></li>
      <li><div class="when">Week 3<span>Integrations</span></div><div class="what"><b>Payments, forms, and booking</b><p>QuickBooks, lead forms, Calendly, analytics, and the social pages all wired up and tested.</p></div></li>
      <li><div class="when">Weeks 3 to 4<span>Launch</span></div><div class="what"><b>Review and go live</b><p>Final revisions, mobile testing, SSL, and launch, comfortably inside your 30 day window.</p></div></li>
    </ul>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Investment</p><h2>Simple, transparent pricing</h2></div>
    <div class="invoice">
      <div class="row"><div class="lbl"><b>Option A, Custom-Coded Platform</b><span>Recommended · one-time build, 50% to start then 50% at launch</span></div><div class="val">$2,950</div></div>
      <div class="row"><div class="lbl"><b>Option B, WordPress Platform</b><span>One-time build, 50% to start then 50% at launch</span></div><div class="val">$2,200</div></div>
      <div class="row"><div class="lbl"><b>Care &amp; Hosting Plan</b><span>Three plans to choose from, see the breakdown below</span></div><div class="val">from $35/mo</div></div>
      <div class="row total"><div class="lbl"><b>To begin, 50% deposit (Custom-Coded)</b><span>Balance of $1,475 due at launch</span></div><div class="val">$1,475</div></div>
    </div>
    <p class="addon-note">Optional add-ons whenever you want them: local and national SEO, Google and Meta ads management, ongoing social content, and extra pages. I will quote those separately, just ask.</p>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">After launch</p><h2>Care &amp; Hosting plans</h2></div>
    <p class="lead" style="margin-bottom:22px;">Once you are live, I keep the site fast, secure, and up to date. Pick how much hands-on help you want. Every plan is month to month, and you can cancel anytime with 30 days notice.</p>
    <div class="plans">
      <div class="plan">
        <p class="optk">Essentials</p>
        <p class="who">Online, secure, and backed up.</p>
        <div class="pprice"><span class="amt">$35</span><span class="per">/month</span></div>
        <ul class="pfeat">
          <li><span class="check">✓</span><span>Managed hosting and SSL certificate</span></li>
          <li><span class="check">✓</span><span>Daily backups</span></li>
          <li><span class="check">✓</span><span>Security monitoring and updates</span></li>
          <li><span class="check">✓</span><span>Uptime monitoring</span></li>
          <li><span class="check">✓</span><span>Email support</span></li>
        </ul>
      </div>
      <div class="plan reco">
        <span class="tag">Recommended</span>
        <p class="optk">Care</p>
        <p class="who">Hands-off upkeep, plus monthly changes.</p>
        <div class="pprice"><span class="amt">$69</span><span class="per">/month</span></div>
        <ul class="pfeat">
          <li class="inc">Everything in Essentials, plus:</li>
          <li><span class="check">✓</span><span>Up to 1 hour of edits each month</span></li>
          <li><span class="check">✓</span><span>Priority, same-day support</span></li>
          <li><span class="check">✓</span><span>Software and plugin updates</span></li>
          <li><span class="check">✓</span><span>Analytics dashboard access</span></li>
        </ul>
      </div>
      <div class="plan">
        <p class="optk">Growth</p>
        <p class="who">Ongoing improvements and reporting.</p>
        <div class="pprice"><span class="amt">$129</span><span class="per">/month</span></div>
        <ul class="pfeat">
          <li class="inc">Everything in Care, plus:</li>
          <li><span class="check">✓</span><span>Up to 3 hours of edits each month</span></li>
          <li><span class="check">✓</span><span>Monthly performance report</span></li>
          <li><span class="check">✓</span><span>Basic SEO monitoring</span></li>
          <li><span class="check">✓</span><span>Quarterly strategy call</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">The details</p><h2>Terms at a glance</h2></div>
    <div class="terms">
      <div class="card"><h3>Payment</h3><p>50% deposit to begin, 50% on launch. Care &amp; Hosting is billed monthly and you can cancel anytime with 30 days notice.</p></div>
      <div class="card"><h3>Revisions</h3><p>I keep revising through the build until the design is right, plus 30 days of edits after launch at no extra cost.</p></div>
      <div class="card"><h3>Ownership</h3><p>Once the final payment clears, the site and everything on it is yours. No lock in. You own your domain, your data, and your build.</p></div>
      <div class="card"><h3>Content</h3><p>We write it together. Your vision and expertise, my design and copywriting. You bring some of the content and I handle the rest.</p></div>
    </div>
  </section>

  <div class="cta">
    <h2>Ready to move by Friday.</h2>
    <p>You wanted to review with your team tomorrow and sign by Friday. This proposal is built for exactly that. Here is all it takes:</p>
    <ul class="steps">
      <li><span class="num">1</span><span>Pick the option that fits your team, custom coded or WordPress.</span></li>
      <li><span class="num">2</span><span>I send over a simple agreement and the deposit invoice to sign online.</span></li>
      <li><span class="num">3</span><span>We kick off Monday and launch inside your 30 day window.</span></li>
    </ul>
    <div class="contact">
      <div><span class="k">Email</span><a href="mailto:reece@nunezdev.com">reece@nunezdev.com</a></div>
      <div><span class="k">Prepared by</span><span class="v2">Reece Nunez, NunezDev</span></div>
      <div><span class="k">Proposal valid</span><span class="v2">30 days from July 21, 2026</span></div>
    </div>
  </div>

  <p class="foot"><b>NunezDev</b> · Custom coded websites and software, built by an engineer. · Confidential proposal prepared for Maria Roman.</p>

</main>`;

export default function LegacyTrainingConsultingProposal() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ltcp" dangerouslySetInnerHTML={{ __html: BODY }} />
    </>
  );
}
