import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  env: {
    // NextAuth required environment variables (these are safe in env config)
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    // Public environment variables
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    // Google Calendar service account file path
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
  },
  serverExternalPackages: ['@supabase/ssr'],
  async headers() {
    // Content-Security-Policy allowlist, grouped by directive. Shipped in
    // REPORT-ONLY mode first: violations are reported to the browser console but
    // nothing is blocked, so we can confirm every legitimate third party is
    // covered before switching to enforcement. Origins reflect the app's real
    // integrations: Stripe, Cloudflare Turnstile, Google Tag Manager/Analytics,
    // Supabase (REST + realtime ws), AWS S3 (presigned uploads), Calendly/Cal.com.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
      // 'unsafe-inline'/'unsafe-eval' are required by Next.js hydration and some
      // bundled libs (three.js, charts). Revisit tightening to nonces later.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.amazonaws.com https://*.r2.cloudflarestorage.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://calendly.com https://*.calendly.com https://cal.com https://app.cal.com https://accounts.google.com",
      "worker-src 'self' blob:",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

    // Optimization for server builds
    if (isServer && !dev) {
      config.optimization.minimize = true;
    }

    return config;
  },
};

export default nextConfig;
