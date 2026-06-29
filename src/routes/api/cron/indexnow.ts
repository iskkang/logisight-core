import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// IndexNow 자동 핑 — 일일 cron. sitemap.xml의 <lastmod> 차분으로 신규/변경 URL만
// Bing·Yandex·Naver 등 IndexNow 참여 엔진에 제출(구글은 IndexNow 미참여).
// 인증: Vercel cron이 CRON_SECRET 설정 시 자동으로 Authorization: Bearer <CRON_SECRET> 헤더를 붙인다.
// 시드: ?seed=1 이면 lastmod 무시하고 sitemap 전체 URL 제출(최초 1회 전 페이지 통지용).

const HOST = "logisight.mtlship.com";
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const WINDOW_MS = 26 * 60 * 60 * 1000; // 일 1회 cron 기준 여유 26시간
const MAX_URLS = 10000;

function parseSitemap(xml: string): { loc: string; lastmod?: string }[] {
  const out: { loc: string; lastmod?: string }[] = [];
  const urlRe = /<url>([\s\S]*?)<\/url>/g;
  let m: RegExpExecArray | null;
  while ((m = urlRe.exec(xml))) {
    const block = m[1];
    const loc = /<loc>(.*?)<\/loc>/.exec(block)?.[1]?.trim();
    const lastmod = /<lastmod>(.*?)<\/lastmod>/.exec(block)?.[1]?.trim();
    if (loc) out.push({ loc, lastmod });
  }
  return out;
}

export const Route = createFileRoute("/api/cron/indexnow")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // 1) 인증
        const auth = request.headers.get("authorization");
        if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }

        const key = process.env.INDEXNOW_KEY;
        if (!key) {
          return Response.json({ error: "INDEXNOW_KEY not set" }, { status: 500 });
        }

        const seed = new URL(request.url).searchParams.get("seed") === "1";

        // 2) sitemap fetch + 파싱
        let entries: { loc: string; lastmod?: string }[];
        try {
          const res = await fetch(SITEMAP_URL, {
            headers: { "user-agent": "logisight-indexnow-cron" },
          });
          if (!res.ok) {
            return Response.json(
              { error: `sitemap fetch ${res.status}` },
              { status: 502 },
            );
          }
          entries = parseSitemap(await res.text());
        } catch (e) {
          return Response.json(
            { error: `sitemap fetch failed: ${(e as Error).message}` },
            { status: 502 },
          );
        }

        // 3) 시드면 전체, 아니면 lastmod 가 최근 26시간 내인 URL만 (lastmod 없으면 제외)
        const cutoff = Date.now() - WINDOW_MS;
        const selected = seed
          ? entries.map((e) => e.loc)
          : entries
              .filter((e) => {
                if (!e.lastmod) return false;
                const t = Date.parse(e.lastmod);
                return !Number.isNaN(t) && t >= cutoff;
              })
              .map((e) => e.loc);

        const urlList = selected.slice(0, MAX_URLS);

        // 미변경: 아무것도 보내지 않음(IndexNow는 반복 핑 비권장)
        if (urlList.length === 0) {
          console.log(`[indexnow] seed=${seed} submitted=0 (no changed URLs)`);
          return Response.json({ seed, submitted: 0, message: "no changed URLs" });
        }

        // 4) IndexNow 제출
        const ping = await fetch(INDEXNOW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: HOST,
            key,
            keyLocation: `https://${HOST}/${key}.txt`,
            urlList,
          }),
        });

        console.log(
          `[indexnow] seed=${seed} submitted=${urlList.length} indexnowStatus=${ping.status}`,
        );

        return Response.json({
          seed,
          submitted: urlList.length,
          truncated: selected.length > MAX_URLS,
          indexnowStatus: ping.status,
        });
      },
    },
  },
});
