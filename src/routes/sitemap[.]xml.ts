import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";
import { SITE_URL as BASE_URL } from "@/lib/seo";
import { PER_PAGE } from "@/lib/api/news";

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
          // "FEU 뜻"·"SCFI란" 같은 검색어 대상. 내용이 정적이라 갱신 빈도는 낮게 잡는다.
          { path: "/glossary", changefreq: "monthly", priority: "0.6" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
        ];

        // ■ lang="ko" 로 반드시 거른다 ★
        // maritime_news 는 한국·일본판이 공유한다. lang 필터가 없을 때 조건에 5,791건이
        // 걸려 상위 500건 안에 한국 기사가 151건뿐이었다(ja 139·en 172·es 15·ru 23).
        // 한국 기사 776건 중 625건이 사이트맵에서 빠지고, 그 자리를 logisight.net 에서는
        // 색인될 이유가 없는 타언어 기사가 차지하고 있었다.
        //
        // ■ 조건은 /news 목록(news.functions.ts)과 같게 맞춘다
        // 사이트맵은 "우리가 링크하는 페이지 목록"이어야 한다. 목록에서 빼는 daily_card·
        // 본문 없는 외부 기사를 사이트맵에만 실으면, 어디서도 링크되지 않는 고아 URL과
        // 원문으로 리다이렉트되는 URL(article.$slug.tsx 의 redirect)을 크롤러에 신고하게 된다.
        let koArticleCount = 0;
        try {
          const { data } = await supabasePublicServer
            .from("maritime_news")
            .select("id,slug,published_at")
            .eq("lang", "ko")
            .or("agent_type.is.null,agent_type.neq.daily_card")
            .or("agent_type.neq.external,and(content.not.is.null,content.neq.)")
            .like("url", "http%")
            .order("published_at", { ascending: false, nullsFirst: false })
            // 전량 수록. 사이트맵 규격 상한은 50,000건이라 여유가 크다.
            .limit(2000);
          koArticleCount = (data ?? []).length;
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

        // /news 페이지네이션 목록. 기사 상세로 가는 내부 링크 경로를 크롤러에 열어준다 —
        // 이게 없으면 2페이지 이후 기사는 사이트맵에만 있고 사이트 안에서 도달 불가라
        // "발견됨 — 색인 생성되지 않음" 으로 남는다. 1페이지는 위의 /news 와 같은 URL 이라 제외.
        const newsPages = Math.ceil(koArticleCount / PER_PAGE);
        for (let p = 2; p <= newsPages; p++) {
          entries.push({
            path: `/news?page=${p}`,
            changefreq: "daily",
            priority: "0.5",
          });
        }

        // 월간 리포트 영구링크. 카탈로그 페이지(/reports)만 실려 있어서 개별 호가 색인되지 않았다.
        // 라우트 파라미터는 period_start 의 연월(/reports/monthly/2026-08).
        // lang=ko 로 거른다 —— reports 테이블은 일본판과 공유한다.
        try {
          const { data } = await supabasePublicServer
            .from("reports")
            .select("period_start,published_at")
            .eq("lang", "ko")
            .eq("type", "monthly")
            .order("period_start", { ascending: false })
            .limit(200);
          for (const row of data ?? []) {
            const param = row.period_start?.slice(0, 7);
            if (!param) continue; // 파라미터를 못 만들면 링크를 지어내지 않는다
            entries.push({
              path: `/reports/monthly/${param}`,
              lastmod: row.published_at ?? undefined,
              changefreq: "monthly",
              priority: "0.7",
            });
          }
        } catch {
          // ignore — still emit core routes
        }

        // 주간 리포트는 weekly_briefings 에서 뽑는다 ★
        // reports.iso_week("2026-W39")를 파라미터로 쓰고 있었지만 /reports/weekly/$week 는
        // weekly_briefings.week_of(날짜)를 조회한다(briefing.functions.ts 의 정규식도 YYYY-MM-DD).
        // 그래서 사이트맵의 주간 URL 전부가 500 이었다. /reports 목록이 링크하는 것과 같은
        // 테이블에서 뽑아야 사이트맵 URL 과 실제 페이지가 어긋나지 않는다.
        try {
          const { data } = await supabasePublicServer
            .from("weekly_briefings")
            .select("week_of,published_at")
            .order("week_of", { ascending: false })
            .limit(200);
          for (const row of data ?? []) {
            if (!row.week_of) continue;
            entries.push({
              path: `/reports/weekly/${row.week_of}`,
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