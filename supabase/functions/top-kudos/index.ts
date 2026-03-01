import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "30d";
    const teamId = url.searchParams.get("teamId") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || "10"), 50);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const startDate = new Date(Date.now() - days * 86400000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const [kudosRes, profilesRes] = await Promise.all([
      supabase.from("kudos").select("to_user_id, category").gte("created_at", startDate),
      supabase.from("profiles").select("id, full_name, team_id, is_active").eq("is_active", true),
    ]);

    if (kudosRes.error) throw kudosRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const profileMap: Record<string, { full_name: string; team_id: string | null }> = {};
    (profilesRes.data || []).forEach((p: any) => {
      profileMap[p.id] = { full_name: p.full_name, team_id: p.team_id };
    });

    let kudos = kudosRes.data || [];
    // Filter by team
    if (teamId) {
      kudos = kudos.filter((k: any) => profileMap[k.to_user_id]?.team_id === teamId);
    }
    // Filter out inactive/unknown users
    kudos = kudos.filter((k: any) => profileMap[k.to_user_id]);

    const counts: Record<string, { count: number; categories: Record<string, number> }> = {};
    kudos.forEach((k: any) => {
      if (!counts[k.to_user_id]) counts[k.to_user_id] = { count: 0, categories: {} };
      counts[k.to_user_id].count++;
      counts[k.to_user_id].categories[k.category] = (counts[k.to_user_id].categories[k.category] || 0) + 1;
    });

    const top = Object.entries(counts)
      .sort(([, a], [, b]) => (b as any).count - (a as any).count)
      .slice(0, limit)
      .map(([uid, d]) => ({
        name: profileMap[uid]?.full_name || "Сотрудник",
        count: (d as any).count,
        topCategory: Object.entries((d as any).categories).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || "",
      }));

    return new Response(JSON.stringify({ data: top, period, total: kudos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
