import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { SITE_URL as BASE_URL } from "@/lib/seo";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/news", changefreq: "daily", priority: "0.9" },
          { path: "/rates", changefreq: "daily", priority: "0.9" },
          { path: "/briefing", changefreq: "daily", priority: "0.9" },
          { path: "/reports", changefreq: "weekly", priority: "0.9" },
          { path: "/eurasia", changefreq: "weekly", priority: "0.8" },
          { path: "/industries", changefreq: "weekly", priority: "0.8" },
          { path: "/climate", changefreq: "daily", priority: "0.8" },
          { path: "/port-risk", changefreq: "daily", priority: "0.8" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/methodology", changefreq: "monthly", priority: "0.5" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
        ];

        try {
          const { data } = await supabasePublicServer
            .from("maritime_news")
            .select("id,slug,published_at")
            // 본문 없는 외부 기사는 우리 페이지가 아니다 — 원문으로 리다이렉트되거나
            // 원문 URL이 깨져 있어 크롤러가 리다이렉트·빈 페이지를 받는다. sitemap에서 제외.
            // (agent_type NULL 행은 neq가 걸러내므로 is.null 절을 따로 둔다)
            .or("agent_type.is.null,agent_type.neq.external,content.not.is.null")
            .order("published_at", { ascending: false, nullsFirst: false })
            .limit(500);
          for (const row of data ?? []) {
            const param =
              row.slug && row.slug.length > 0 ? row.slug : String(row.id);
            entries.push({
              // sitemap 규격상 <loc>는 percent-인코딩 필수 — 원시 한글이면 크롤러가 잘못 fetch한다
              path: `/article/${encodeURIComponent(param)}`,
              lastmod: row.published_at ?? undefined,
              changefreq: "monthly",
              priority: "0.6",
            });
          }
        } catch {
          // ignore — still emit core routes
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});