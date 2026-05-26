"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

// Lightweight Cloudflare Turnstile wrapper.
//
// Behavior:
// - If NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, renders nothing. Lets the
//   form work locally without Turnstile keys; server-side verification is
//   also no-op in that case (see lib/turnstile.ts).
// - When mounted with a real site key, loads Cloudflare's api.js once and
//   renders the widget. The token is stored in a hidden <input> the
//   widget injects with name="cf-turnstile-response", so it's auto-picked
//   up by any surrounding <form> via FormData.

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; theme?: "light" | "dark" | "auto"; size?: "normal" | "compact" }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

type Props = {
  /** Visual theme; defaults to "auto" (matches the site's dark UI). */
  theme?: "light" | "dark" | "auto";
  /** "compact" if you need a smaller widget on tight forms. */
  size?: "normal" | "compact";
};

export default function Turnstile({ theme = "auto", size = "normal" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    let cancelled = false;

    const renderWidget = () => {
      if (cancelled) return;
      if (!window.turnstile || !containerRef.current) return;
      // Don't double-render if React strict-mode replays the effect.
      if (widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      // Poll briefly until the script loads.
      const id = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(id);
          renderWidget();
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }
  }, [siteKey, theme, size]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        async
        defer
      />
      <div ref={containerRef} className="cf-turnstile" />
    </>
  );
}
