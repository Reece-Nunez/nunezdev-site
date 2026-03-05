import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/api",
          "/portal",
          "/invoice",
          "/login",
          "/pay",
          "/proposal",
        ],
      },
    ],
    sitemap: "https://www.nunezdev.com/sitemap.xml",
  };
}
