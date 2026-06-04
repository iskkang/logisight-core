// Server-side Supabase client using the PUBLISHABLE (anon) key.
// Use for SSR reads of public, RLS-allowed (anon SELECT) tables when a
// service role key is not provisioned locally. Does NOT bypass RLS.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import type { Database } from "./types";

function createPublicServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    realtime: { transport: ws },
  });
}

let _client: ReturnType<typeof createPublicServerClient> | undefined;

export const supabasePublicServer = new Proxy({} as ReturnType<typeof createPublicServerClient>, {
  get(_, prop, receiver) {
    if (!_client) _client = createPublicServerClient();
    return Reflect.get(_client, prop, receiver);
  },
});
