import type { MetadataRoute } from "next";

// §47 — storefront is indexable; studio/admin/checkout are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/studio", "/checkout", "/cart", "/pay", "/orders", "/account", "/api"],
    },
    sitemap: "/sitemap.xml",
  };
}
