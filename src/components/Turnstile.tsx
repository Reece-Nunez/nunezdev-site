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
      remove: (widgetId: string) => void;
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
    // Guard: ensure the env var actually arrived as a string. Misconfigured
    // builds have surfaced as { sitekey: <object> } at the Cloudflare layer.
    if (!siteKey || typeof siteKey !== "string" || !containerRef.current) return;

    let cancelled = false;
    let pollId: number | null = null;

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
      pollId = window.setInterval(() => {
        if (window.turnstile) {
          if (pollId !== null) window.clearInterval(pollId);
          pollId = null;
          renderWidget();
        }
      }, 100);
    }

    return () => {
      cancelled = true;
      if (pollId !== null) window.clearInterval(pollId);
      // Cleanly remove the widget so re-mounts (modal open/close, route
      // changes) don't leak widgets or trigger "Cannot find Widget" warnings.
      if (widgetIdRef.current && window.turnstile?.remove) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Cloudflare throws if the widget was already cleaned — swallow it.
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="lazyOnload"
        async
        defer
      />
      {/* No `cf-turnstile` class — that would trigger Cloudflare's
          auto-render in parallel with our explicit render() call, causing
          double-render conflicts and the "got 'object'" sitekey error. */}
      <div ref={containerRef} />
    </>
  );
}
