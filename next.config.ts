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
  serverExternalPackages: ['@supabase/ssr', 'googleapis'],
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

    // Handle googleapis as external for server builds to reduce memory usage
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('googleapis');
      } else {
        config.externals = [config.externals, 'googleapis'];
      }
    }

    return config;
  },
};

export default nextConfig;
