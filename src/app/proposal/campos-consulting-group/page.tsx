import type { Metadata } from "next";

// One-off, hand-built pitch proposal for Campos Consulting Group (Lorena Campos),
// a Texas government-affairs firm in Austin (Thumbtack lead, ccgaustin.com).
// This is NOT the DB-driven /proposal/[token] flow. It's a bespoke marketing
// document, so it ships as a static route. ChromeGate already hides the site
// Navbar/Footer for any /proposal/* path, giving it a focused, standalone feel.
// All styles are scoped under `.ccgp` so nothing leaks into the rest of the site.

export const metadata: Metadata = {
  title: "Website Proposal · Campos Consulting Group",
  description: "Website proposal prepared by NunezDev for Campos Consulting Group.",
  robots: { index: false, follow: false },
};

const CSS = String.raw`/* Hallmark · macrostructure: Long Document · tone: professional/personable (Reece's voice) · anchor hue: brand yellow #ffc312
 * Genre: modern-minimal (government-affairs professional services). Component-scope: single proposal doc.
 * Fixed dark-panel tokens (--panel*) never theme-flip; --navy stays a flipping text/link token. */
.ccgp { --paper: #fbf8f3;
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
  .ccgp { --paper: #0e1013;
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
.ccgp[data-theme="light"] { --paper: #fbf8f3; --paper-2: #ffffff; --paper-3: #f3ece1;
  --ink: #14161a; --ink-2: #43474e; --ink-3: #74787f;
  --line: #e5ddd0; --line-2: #d8cfbf; --navy: #0b2a4a;
  --brand-deep: #b8850a; --good: #1f7a4d;
  --shadow: 0 1px 2px rgba(20,22,26,.05), 0 10px 30px -18px rgba(20,22,26,.25); }
.ccgp[data-theme="dark"] { --paper: #0e1013; --paper-2: #16191e; --paper-3: #1c2026;
  --ink: #f3f0ea; --ink-2: #b9bcc2; --ink-3: #878b93;
  --line: #262b32; --line-2: #313842; --navy: #4f93da;
  --brand-deep: #ffd451; --good: #4cc98a;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 18px 40px -22px rgba(0,0,0,.7); }
.ccgp, .ccgp * { box-sizing: border-box; }
.ccgp { overflow-x: clip; }
.ccgp { margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: 16.5px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility; min-height: 100vh; }
.ccgp .wrap { max-width: 940px; margin: 0 auto; padding: 0 22px; }
.ccgp .doc { max-width: 940px; margin: 0 auto; padding: 0 22px 100px; }
.ccgp h1, .ccgp h2, .ccgp h3 { line-height: 1.12; letter-spacing: -.018em; overflow-wrap: anywhere; text-wrap: balance; }
.ccgp p { max-width: var(--measure); }
.ccgp a { color: var(--navy); }
.ccgp .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
  color: var(--brand-deep); margin: 0; }
.ccgp .rule { height: 1px; background: var(--line); border: 0; margin: 0; }
/* ---------- Masthead (fixed dark panel) ---------- */
.ccgp .mast { background: var(--panel);
  color: var(--panel-fg);
  border-bottom: 4px solid var(--brand); }
.ccgp .mast .wrap { padding-top: 30px; padding-bottom: 34px; }
.ccgp .mast-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ccgp .brandmark { display: flex; align-items: center; gap: 11px; font-weight: 800; letter-spacing: -.02em; font-size: 20px; color: var(--panel-fg); }
.ccgp .brandmark .logo { height: 34px; width: auto; display: block; }
.ccgp .mast-meta { text-align: right; font-size: 12.5px; color: var(--panel-dim); line-height: 1.5; }
.ccgp .mast h1 { font-size: clamp(30px, 6vw, 50px); margin: 30px 0 0; color: var(--panel-fg); font-weight: 800; max-width: 15ch; }
.ccgp .mast .sub { margin: 14px 0 0; color: var(--panel-sub); font-size: 17px; max-width: 60ch; }
.ccgp .prepared { margin-top: 26px; display: flex; gap: 34px 46px; flex-wrap: wrap;
  border-top: 1px solid var(--panel-line); padding-top: 20px; }
.ccgp .prepared div { min-width: 0; }
.ccgp .prepared .k { font-size: 11px; letter-spacing: .13em; text-transform: uppercase; color: var(--panel-dim); margin: 0 0 3px; }
.ccgp .prepared .v { font-size: 15px; color: var(--panel-fg); margin: 0; font-weight: 600; }
/* ---------- Sections ---------- */
.ccgp section { padding-top: 56px; }
.ccgp .sec-head { margin-bottom: 22px; }
.ccgp .sec-head h2 { font-size: clamp(22px, 3.6vw, 30px); margin: 8px 0 0; font-weight: 750; }
.ccgp .lead { font-size: 18px; color: var(--ink-2); }
/* Letter */
.ccgp .letter p { margin: 0 0 15px; color: var(--ink-2); font-size: 17px; }
.ccgp .letter .sign { margin-top: 22px; font-weight: 600; color: var(--ink); }
.ccgp .letter .sign span { display: block; color: var(--ink-3); font-weight: 500; font-size: 14px; }
/* Understanding grid */
.ccgp .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.ccgp .card { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 20px 20px; box-shadow: var(--shadow); }
.ccgp .card h3 { font-size: 15px; margin: 0 0 6px; font-weight: 700; }
.ccgp .card p { font-size: 14.5px; color: var(--ink-2); margin: 0; }
.ccgp .pagelist { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 0 26px; }
.ccgp .pagelist li { padding: 11px 0; border-bottom: 1px solid var(--line); display: flex; gap: 11px; align-items: baseline; }
.ccgp .pagelist .n { font-family: var(--font-mono); font-size: 12px; color: var(--brand-deep); font-weight: 700; min-width: 20px; }
.ccgp .pagelist .t { font-weight: 650; font-size: 15px; }
.ccgp .pagelist .d { color: var(--ink-3); font-size: 13.5px; display: block; }
/* Single build feature list */
.ccgp .feat { list-style: none; margin: 0; padding: 16px 0 0; border-top: 1px solid var(--line); display: grid; gap: 9px; }
.ccgp .feat li { display: flex; gap: 9px; font-size: 14.5px; color: var(--ink-2); align-items: baseline; }
.ccgp .feat li b { color: var(--ink); font-weight: 650; }
.ccgp .check { color: var(--good); font-weight: 800; flex: 0 0 auto; }
.ccgp .buildcard { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px 24px; box-shadow: var(--shadow); }
.ccgp .buildcard .blurb { font-size: 15px; color: var(--ink-2); margin: 0; }
/* Included checklist */
.ccgp .checklist { list-style: none; margin: 0; padding: 22px 24px; display: grid; grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 11px 26px; background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.ccgp .checklist li { display: flex; gap: 10px; font-size: 14.5px; color: var(--ink-2); align-items: baseline; }
.ccgp .checklist li b { color: var(--ink); font-weight: 650; }
/* Timeline */
.ccgp .timeline { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
.ccgp .timeline li { display: grid; grid-template-columns: 150px 1fr; gap: 20px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.ccgp .timeline li:last-child { border-bottom: 0; }
.ccgp .timeline .when { font-weight: 700; font-size: 14px; color: var(--navy); }
.ccgp .timeline .when span { display: block; font-weight: 500; color: var(--ink-3); font-size: 12.5px; }
.ccgp .timeline .what b { font-weight: 680; }
.ccgp .timeline .what p { margin: 3px 0 0; font-size: 14px; color: var(--ink-2); }
/* Investment */
.ccgp .invoice { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
.ccgp .invoice .row { display: flex; justify-content: space-between; gap: 16px; padding: 15px 22px; border-bottom: 1px solid var(--line); }
.ccgp .invoice .row .lbl b { font-weight: 680; }
.ccgp .invoice .row .lbl span { display: block; color: var(--ink-3); font-size: 13px; }
.ccgp .invoice .row .val { font-weight: 720; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ccgp .invoice .row.total { background: var(--panel); color: var(--panel-fg); border-bottom: 0; }
.ccgp .invoice .row.total .val { font-size: 20px; }
.ccgp .invoice .row.total .lbl span { color: var(--panel-dim); }
.ccgp .addon-note { font-size: 13px; color: var(--ink-3); margin: 14px 2px 0; }
/* Terms + next */
.ccgp .terms { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.ccgp .terms .card p { margin-top: 4px; }
.ccgp .cta { margin-top: 30px; background: var(--panel); color: var(--panel-fg); border-radius: var(--radius);
  padding: 32px 30px; box-shadow: var(--shadow); border-top: 4px solid var(--brand); }
.ccgp .cta h2 { color: var(--panel-fg); font-size: clamp(22px,3.4vw,28px); margin: 0; }
.ccgp .cta p { color: var(--panel-sub); margin: 12px 0 0; max-width: 58ch; }
.ccgp .cta .steps { margin: 20px 0 0; padding: 0; list-style: none; display: grid; gap: 10px; }
.ccgp .cta .steps li { display: flex; gap: 12px; align-items: baseline; color: var(--panel-fg); font-size: 15px; }
.ccgp .cta .steps .num { flex: 0 0 auto; width: 24px; height: 24px; border-radius: 999px; background: var(--brand); color: var(--brand-ink); font-weight: 800; font-size: 13px; display: grid; place-items: center; }
.ccgp .cta .contact { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--panel-line); display: flex; gap: 28px; flex-wrap: wrap; font-size: 14px; }
.ccgp .cta .contact a { color: var(--brand); text-decoration: none; font-weight: 650; }
.ccgp .cta .contact .k { color: var(--panel-dim); display: block; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 2px; }
.ccgp .cta .contact .v2 { color: var(--panel-sub); }
.ccgp .foot { margin-top: 42px; text-align: center; color: var(--ink-3); font-size: 12.5px; }
.ccgp .foot b { color: var(--ink-2); }
/* Care & Hosting plans */
.ccgp .plans { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; align-items: start; }
.ccgp .plan { position: relative; background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius); padding: 24px 20px 22px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
.ccgp .plan.reco { border-color: var(--brand); border-width: 1.5px; }
.ccgp .plan .tag { position: absolute; top: -12px; left: 20px; background: var(--brand); color: var(--brand-ink); font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; padding: 5px 11px; border-radius: 999px; }
.ccgp .plan .optk { font-size: 12px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; color: var(--ink); margin: 0; }
.ccgp .plan .who { font-size: 13px; color: var(--ink-3); margin: 6px 0 0; min-height: 34px; }
.ccgp .pprice { display: flex; align-items: baseline; gap: 4px; margin: 12px 0 0; }
.ccgp .pprice .amt { font-size: 28px; font-weight: 820; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.ccgp .pprice .per { font-size: 13px; color: var(--ink-3); }
.ccgp .pfeat { list-style: none; margin: 16px 0 0; padding: 15px 0 0; border-top: 1px solid var(--line); display: grid; gap: 9px; }
.ccgp .pfeat li { display: flex; gap: 9px; font-size: 13.5px; color: var(--ink-2); align-items: baseline; }
.ccgp .pfeat li.inc { color: var(--ink); font-weight: 700; font-size: 12.5px; }
@media (max-width: 720px) {
  .ccgp { font-size: 16px; min-height: 100vh; }
  .ccgp .grid2, .ccgp .terms, .ccgp .pagelist, .ccgp .plans, .ccgp .checklist { grid-template-columns: 1fr; }
  .ccgp .timeline li { grid-template-columns: 1fr; gap: 4px; }
  .ccgp .mast-meta { text-align: left; }
}`;

const BODY = String.raw`<header class="mast">
  <div class="wrap">
    <div class="mast-top">
      <div class="brandmark"><img class="logo" src="/letter-logo.png" alt="NunezDev logo" /> NunezDev</div>
      <div class="mast-meta">
        Website Proposal &middot; Rev. A<br>
        Prepared July 22, 2026 &middot; Valid 30 days
      </div>
    </div>
    <p class="eyebrow" style="color:var(--brand); margin-top:28px;">Texas Government Affairs &middot; Austin</p>
    <h1>A website that opens the room before you do.</h1>
    <p class="sub">A clean, fast, five-page site for Campos Consulting Group, with the cinematic Capitol open you described and the quiet authority your clients expect.</p>
    <div class="prepared">
      <div>
        <p class="k">Prepared for</p>
        <p class="v">Lorena Campos</p>
      </div>
      <div>
        <p class="k">Organization</p>
        <p class="v">Campos Consulting Group</p>
      </div>
      <div>
        <p class="k">Prepared by</p>
        <p class="v">Reece Nunez &middot; NunezDev</p>
      </div>
      <div>
        <p class="k">Target launch</p>
        <p class="v">About 10 days from deposit</p>
      </div>
    </div>
  </div>
</header>

<main class="doc">

  <section class="letter" style="padding-top:52px;">
    <div class="sec-head"><p class="eyebrow">A quick note</p><h2>Thanks for reaching out, Lorena.</h2></div>
    <p>And thanks for sending the sites you like. That made this easy. They all read the same way: clean, confident, and clearly serious about the work. That is exactly the lane Campos Consulting Group belongs in, and honestly your current GoDaddy site is selling you short of it.</p>
    <p>You said you want something simple and pretty, around five pages, with a landing moment built on the Capitol. I am completely on board. For a government affairs firm, the website has one job before anyone reads a word: signal that you belong in the room. A full-width shot of Congress Avenue, sharp typography, and fast load times do most of that in the first three seconds.</p>
    <p>Here is how I would build it. Everything is coded by hand, no page builder bloat, so it loads fast and ranks well, and it is priced right inside the range you gave me. Take a look and let me know what you think. Feel free to call or text me anytime.</p>
    <p class="sign">Reece Nunez<span>Founder &amp; Software Engineer, NunezDev</span></p>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">What we're building</p><h2>Your firm, the way I see it</h2></div>
    <p class="lead" style="margin-bottom:22px;">A calm, credible, conversion-minded site with one job: make a legislator, agency, or prospective client take Campos Consulting Group seriously the moment it loads.</p>
    <div class="grid2">
      <div class="card"><h3>The Capitol open</h3><p>A full-width hero reel of the Capitol and Congress Avenue, the cinematic landing moment you asked for, optimized so it still loads fast.</p></div>
      <div class="card"><h3>Instant credibility</h3><p>Clean typography, calm color, and the same confident feel as the firms you shared. You look like the room you work in.</p></div>
      <div class="card"><h3>A clear service story</h3><p>Legislative representation, state agency engagement, and coalition strategy, laid out so prospects understand what you do at a glance.</p></div>
      <div class="card"><h3>Easy to reach you</h3><p>A simple inquiry form routed straight to your inbox, plus click-to-call your direct line throughout the site.</p></div>
    </div>

    <h3 style="font-size:15px; letter-spacing:.05em; text-transform:uppercase; color:var(--ink-3); margin:34px 0 4px;">Page architecture</h3>
    <ul class="pagelist">
      <li><span class="n">01</span><span><span class="t">Home</span><span class="d">Capitol hero reel, positioning line, services snapshot, primary call to action</span></span></li>
      <li><span class="n">02</span><span><span class="t">Services</span><span class="d">Legislative representation, state agency engagement, coalition &amp; client strategy</span></span></li>
      <li><span class="n">03</span><span><span class="t">About &amp; Team</span><span class="d">Your bio and Aaron's, the firm's mission, ethics, and relationships</span></span></li>
      <li><span class="n">04</span><span><span class="t">Our Approach</span><span class="d">The three-step method: understand the issue, build the relationships, execute with discipline</span></span></li>
      <li><span class="n">05</span><span><span class="t">Contact</span><span class="d">Inquiry form, your Congress Avenue office, direct line, and hours</span></span></li>
    </ul>
  </section>
  <section>
    <div class="sec-head"><p class="eyebrow">How I build it</p><h2>Hand-coded, no bloat</h2></div>
    <div class="buildcard">
      <p class="blurb">I am a software engineer, not a plugin installer, so your site gets coded by hand with nothing weighing it down. That is what makes it fast, secure, and easy for Google to favor, and it means the Capitol video hero is done properly instead of dropped in as a heavy widget.</p>
      <ul class="feat">
        <li><span class="check">&#10003;</span><span>100% unique design, coded by hand, <b>no templates</b></span></li>
        <li><span class="check">&#10003;</span><span>Top-tier <b>page speed</b> for better Google ranking</span></li>
        <li><span class="check">&#10003;</span><span>Full-width <b>Capitol video hero</b>, optimized to stay fast</span></li>
        <li><span class="check">&#10003;</span><span>Simple <b>content editor</b> so your team updates text yourselves</span></li>
        <li><span class="check">&#10003;</span><span>Locked-down security, <b>no plugin vulnerabilities</b></span></li>
        <li><span class="check">&#10003;</span><span>Room to grow if you add pages or team later</span></li>
      </ul>
    </div>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Everything included</p><h2>What's in the build</h2></div>
    <ul class="checklist">
      <li><span class="check">&#10003;</span><span>Five-page custom design, <b>100% unique</b></span></li>
      <li><span class="check">&#10003;</span><span>Full-width <b>Capitol / Congress hero video</b></span></li>
      <li><span class="check">&#10003;</span><span>Mobile-responsive across all devices</span></li>
      <li><span class="check">&#10003;</span><span>Keep <b>ccgaustin.com</b>, migrated off GoDaddy</span></li>
      <li><span class="check">&#10003;</span><span>Simple content editor for your team</span></li>
      <li><span class="check">&#10003;</span><span>Custom contact &amp; inquiry form to your inbox</span></li>
      <li><span class="check">&#10003;</span><span>Click-to-call your direct line site-wide</span></li>
      <li><span class="check">&#10003;</span><span>Google Analytics</span></li>
      <li><span class="check">&#10003;</span><span>SEO-friendly structure, sitemap, fast speed</span></li>
      <li><span class="check">&#10003;</span><span>Hosting and SSL certificate</span></li>
      <li><span class="check">&#10003;</span><span>Copy polish on the content you provide</span></li>
      <li><span class="check">&#10003;</span><span><b>30 days of edits</b> after launch, included</span></li>
    </ul>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">Getting to launch</p><h2>Live in about ten days</h2></div>
    <ul class="timeline">
      <li><div class="when">This week<span>Kickoff</span></div><div class="what"><b>Agreement and deposit</b><p>You approve the scope, the 50% deposit clears, and we lock in your kickoff.</p></div></li>
      <li><div class="when">Days 1 to 2<span>Content</span></div><div class="what"><b>Kickoff and assets</b><p>You send your logo, bios, and any copy or footage you have. I map the sitemap and gather Capitol video.</p></div></li>
      <li><div class="when">Days 3 to 4<span>Design</span></div><div class="what"><b>Homepage concept</b><p>You approve the hero and homepage direction before I build the rest of the pages.</p></div></li>
      <li><div class="when">Days 5 to 8<span>Build</span></div><div class="what"><b>Full development</b><p>All five pages built out, video hero wired in, forms connected, with your feedback as I go.</p></div></li>
      <li><div class="when">Days 9 to 10<span>Launch</span></div><div class="what"><b>Review and go live</b><p>Final revisions, mobile testing, SSL, and launch on ccgaustin.com.</p></div></li>
    </ul>
  </section>
  <section>
    <div class="sec-head"><p class="eyebrow">Investment</p><h2>Simple, transparent pricing</h2></div>
    <div class="invoice">
      <div class="row"><div class="lbl"><b>Custom-Coded Firm Website</b><span>Five pages, Capitol hero, forms &middot; one-time build, 50% to start then 50% at launch</span></div><div class="val">$1,950</div></div>
      <div class="row"><div class="lbl"><b>Care &amp; Hosting Plan</b><span>Three plans to choose from, see the breakdown below</span></div><div class="val">from $35/mo</div></div>
      <div class="row total"><div class="lbl"><b>To begin, 50% deposit</b><span>Balance of $975 due at launch</span></div><div class="val">$975</div></div>
    </div>
    <p class="addon-note">Optional add-ons whenever you want them: local SEO, Google and Meta ads management, ongoing content, and extra pages. I will quote those separately, just ask.</p>
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
          <li><span class="check">&#10003;</span><span>Managed hosting and SSL certificate</span></li>
          <li><span class="check">&#10003;</span><span>Daily backups</span></li>
          <li><span class="check">&#10003;</span><span>Security monitoring and updates</span></li>
          <li><span class="check">&#10003;</span><span>Uptime monitoring</span></li>
          <li><span class="check">&#10003;</span><span>Email support</span></li>
        </ul>
      </div>
      <div class="plan reco">
        <span class="tag">Recommended</span>
        <p class="optk">Care</p>
        <p class="who">Hands-off upkeep, plus monthly changes.</p>
        <div class="pprice"><span class="amt">$69</span><span class="per">/month</span></div>
        <ul class="pfeat">
          <li class="inc">Everything in Essentials, plus:</li>
          <li><span class="check">&#10003;</span><span>Up to 1 hour of edits each month</span></li>
          <li><span class="check">&#10003;</span><span>Priority, same-day support</span></li>
          <li><span class="check">&#10003;</span><span>Software updates</span></li>
          <li><span class="check">&#10003;</span><span>Analytics dashboard access</span></li>
        </ul>
      </div>
      <div class="plan">
        <p class="optk">Growth</p>
        <p class="who">Ongoing improvements and reporting.</p>
        <div class="pprice"><span class="amt">$129</span><span class="per">/month</span></div>
        <ul class="pfeat">
          <li class="inc">Everything in Care, plus:</li>
          <li><span class="check">&#10003;</span><span>Up to 3 hours of edits each month</span></li>
          <li><span class="check">&#10003;</span><span>Monthly performance report</span></li>
          <li><span class="check">&#10003;</span><span>Basic SEO monitoring</span></li>
          <li><span class="check">&#10003;</span><span>Quarterly strategy call</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><p class="eyebrow">The details</p><h2>Terms at a glance</h2></div>
    <div class="terms">
      <div class="card"><h3>Payment</h3><p>50% deposit to begin, 50% on launch. Care &amp; Hosting is billed monthly and you can cancel anytime with 30 days notice.</p></div>
      <div class="card"><h3>Revisions</h3><p>I keep revising through the build until the design is right, plus 30 days of edits after launch at no extra cost.</p></div>
      <div class="card"><h3>Ownership</h3><p>Once the final payment clears, the site is yours. You keep ccgaustin.com, your content, and your build. No lock in.</p></div>
      <div class="card"><h3>Content</h3><p>You provide most of it, your bios, service copy, and any Capitol footage. I polish the wording and handle the rest.</p></div>
    </div>
  </section>

  <div class="cta">
    <h2>You wanted this within the week.</h2>
    <p>So did I. This proposal is priced and scoped to move fast. Here is all it takes:</p>
    <ul class="steps">
      <li><span class="num">1</span><span>Approve the scope and send the 50% deposit.</span></li>
      <li><span class="num">2</span><span>I send a simple agreement and the deposit invoice to sign online.</span></li>
      <li><span class="num">3</span><span>We kick off within a day and launch on ccgaustin.com in about ten days.</span></li>
    </ul>
    <div class="contact">
      <div><span class="k">Email</span><a href="mailto:reece@nunezdev.com">reece@nunezdev.com</a></div>
      <div><span class="k">Prepared by</span><span class="v2">Reece Nunez, NunezDev</span></div>
      <div><span class="k">Proposal valid</span><span class="v2">30 days from July 22, 2026</span></div>
    </div>
  </div>

  <p class="foot"><b>NunezDev</b> &middot; Custom coded websites and software, built by an engineer. &middot; Confidential proposal prepared for Lorena Campos, Campos Consulting Group.</p>

</main>`;

export default function CamposConsultingGroupProposal() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ccgp" dangerouslySetInnerHTML={{ __html: BODY }} />
    </>
  );
}
