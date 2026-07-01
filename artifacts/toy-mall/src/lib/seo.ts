import { useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════
   SEO config + a dependency-free document-head manager.

   ⚠️  Update SITE.url to your real production domain. It is used for
   canonical URLs, Open Graph / Twitter image URLs, sitemap, and
   structured data. Search-replace "https://addisonbill.com" across
   the repo (index.html, robots.txt, sitemap.xml) if it differs.
═══════════════════════════════════════════════════════════════ */

export const SITE = {
  name: "Addison Bill",
  url: "https://addisonbill.com",
  twitter: "@addisonbill",
  locale: "en_IN",
  defaultTitle: "Addison Bill — India's Simplest Billing & Inventory Software",
  defaultDescription:
    "Addison Bill is India's simplest GST billing & inventory software for shopkeepers. Make bills in 5 seconds, accept UPI, auto-track stock. Start free.",
  ogImage: "/opengraph.jpg",
};

type SeoInput = {
  title?: string;
  description?: string;
  /** Path only, e.g. "/terms". Combined with SITE.url for canonical/OG. */
  path?: string;
  noindex?: boolean;
  /** Optional JSON-LD object(s) injected into <head> for this route. */
  jsonLd?: object | object[];
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  const sel = `meta[${attr}="${key}"][data-seo]`;
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute("data-seo", "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  const sel = `link[rel="${rel}"][data-seo]`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    el.setAttribute("data-seo", "");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({ title, description, path = "/", noindex = false, jsonLd }: SeoInput) {
  useEffect(() => {
    const fullTitle = title ?? SITE.defaultTitle;
    const desc = (description ?? SITE.defaultDescription).slice(0, 300);
    const url = SITE.url + path;
    const img = SITE.url + SITE.ogImage;

    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertMeta(
      "name",
      "robots",
      noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1",
    );
    upsertLink("canonical", url);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE.name);
    upsertMeta("property", "og:locale", SITE.locale);
    upsertMeta("property", "og:image", img);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:site", SITE.twitter);
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", img);

    // Per-route JSON-LD (removed on cleanup so routes don't accumulate).
    const scripts: HTMLScriptElement[] = [];
    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const block of blocks) {
        const s = document.createElement("script");
        s.type = "application/ld+json";
        s.setAttribute("data-seo-jsonld", "");
        s.textContent = JSON.stringify(block);
        document.head.appendChild(s);
        scripts.push(s);
      }
    }
    return () => scripts.forEach((s) => s.remove());
  }, [title, description, path, noindex, JSON.stringify(jsonLd ?? null)]);
}
