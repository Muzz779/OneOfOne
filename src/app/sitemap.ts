import type { MetadataRoute } from "next";
import { SEED_PRODUCTS } from "@/domain/products";

// §47 — index the storefront: home, products, and each product page.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: "/", lastModified: now, priority: 1 },
    { url: "/products", lastModified: now, priority: 0.8 },
    ...SEED_PRODUCTS.filter((p) => p.active).map((p) => ({
      url: `/products/${p.slug}`,
      lastModified: now,
      priority: 0.7,
    })),
  ];
}
