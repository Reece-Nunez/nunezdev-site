"use client";

import { useEffect } from "react";

export default function CalendlyEmbed({ onScheduled }: { onScheduled: () => void }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    document.body.appendChild(script);

    const handler = (e: MessageEvent) => {
      if (e.origin.includes("calendly.com") && e.data?.event === "calendly.event_scheduled") {
        onScheduled();
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
      document.body.removeChild(script);
    };
  }, [onScheduled]);

  return (
    <div
      className="calendly-inline-widget"
      data-url="https://calendly.com/reece-nunezdev/discovery-call"
      style={{ minWidth: "320px", height: "900px" }}
    />
  );
}
