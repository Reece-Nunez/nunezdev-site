// Single source of truth for NunezDev contact info + business identity.
// Used by Navbar, Footer, Hero, Contact page, and StructuredData so the
// phone number, address, and GBP link can never drift between surfaces.

export const PHONE_DISPLAY = "(435) 660-6100";
export const PHONE_TEL = "+14356606100";
export const EMAIL = "reece@nunezdev.com";

export const BUSINESS_NAME = "NunezDev";
export const BUSINESS_LEGAL_NAME = "NunezDev LLC";

export const ADDRESS = {
  city: "Ponca City",
  region: "OK",
  regionFull: "Oklahoma",
  postalCode: "74601",
  country: "US",
} as const;

// Paste your full Google Business Profile share URL here once you have it.
// Until then, the footer falls back to a Google Maps search.
export const GOOGLE_BUSINESS_URL =
  "https://www.google.com/search?q=NunezDev+Ponca+City+OK";

// Aggregate review snapshot — keep in sync with /src/data/testimonials.ts.
// Surfaced in JSON-LD (AggregateRating) and the homepage social-proof strip.
export const REVIEW_SUMMARY = {
  rating: 5.0,
  count: 15,
} as const;
