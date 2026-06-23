import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { supabasePublicServer } from "@/integrations/supabase/public.server";

export const Route = createFileRoute("/api/trade/brief")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const period = new URL(request.url).searchParams.get("period") ?? "";
        if (!period) return new Response("null", { status: 404 });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabasePublicServer as any)
          .from("trade_briefs")
          .select("verdict,detail")
          .eq("period", period)
          .maybeSingle();

        if (error) throw new Error((error as { message: string }).message);
        if (!data) return new Response("null", { status: 404 });
        return Response.json(data);
      },
    },
  },
});
