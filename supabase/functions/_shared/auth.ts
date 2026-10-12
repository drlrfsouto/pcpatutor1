import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
