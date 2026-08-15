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
        // ■ 리다이렉트 라우트는 넣지 않는다 ★
        // /briefing 과 /eurasia 가 들어 있었는데 둘 다 다른 경로로 리다이렉트하는 라우트다.
        // sitemap 은 "정본 URL 목록"이라 리다이렉트 URL 을 싣는 건 규격 위반이고,
        // 크롤러에 매번 한 홉을 더 태운다. 페이지는 그대로 두고 목록에서만 뺀다.
        //
        // ■ /asia 는 넣지 않는다
        // noindex 부록이다. noindex 페이지를 sitemap 에 올리면 서로 반대말을 하는 셈이다.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/news", changefreq: "daily", priority: "0.9" },
          { path: "/rates", changefreq: "daily", priority: "0.9" },
          { path: "/reports", changefreq: "weekly", priority: "0.9" },
          { path: "/dashboard", changefreq: "daily", priority: "0.9" },
          { path: "/trade", changefreq: "weekly", priority: "0.8" },
          { path: "/forecasts", changefreq: "weekly", priority: "0.8" },
          { path: "/industries", changefreq: "weekly", priority: "0.8" },
          { path: "/climate", changefreq: "daily", priority: "0.8" },
          { path: "/port-risk", changefreq: "daily", priority: "0.8" },
          { path: "/rail/americas", changefreq: "weekly", priority: "0.7" },
          { path: "/rail/eurasia", changefreq: "weekly", priority: "0.7" },
          { path: "/index1520/routes", changefreq: "weekly", priority: "0.6" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/methodology", changefreq: "monthly", priority: "0.5" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
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

        // 리포트 영구링크. 카탈로그 페이지(/reports)만 실려 있어서 개별 호가 색인되지 않았다.
        // 주간은 iso_week(2026-W32), 월간은 period_start 의 연월(2026-08)이 라우트 파라미터다.
        // lang=ko 로 거른다 —— reports 테이블은 일본판과 공유한다.
        try {
          const { data } = await supabasePublicServer
            .from("reports")
            .select("type,iso_week,period_start,published_at")
            .eq("lang", "ko")
            .in("type", ["weekly", "monthly"])
            .order("period_start", { ascending: false })
            .limit(200);
          for (const row of data ?? []) {
            const param =
              row.type === "weekly" ? row.iso_week : row.period_start?.slice(0, 7);
            if (!param) continue; // 파라미터를 못 만들면 링크를 지어내지 않는다
            entries.push({
              path: `/reports/${row.type}/${param}`,
              lastmod: row.published_at ?? undefined,
              changefreq: "monthly",
              priority: "0.7",
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