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

export async function requireApprovedUser(req: Request) {
  const user = await requireAuthenticatedUser(req);
  if (!user) return { status: "unauthenticated" as const, user: null };

  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authorization || !url || !anonKey) return { status: "unavailable" as const, user };

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("pcpa_access_requests")
    .select("approved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { status: "unavailable" as const, user };
  if (!data?.approved_at) return { status: "pending" as const, user };
  return { status: "approved" as const, user };
}
