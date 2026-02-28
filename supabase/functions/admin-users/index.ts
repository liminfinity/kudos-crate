import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Unauthorized");

    const admin = createClient(supabaseUrl, serviceKey);

    // Check caller is admin
    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (!roleData || roleData.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, full_name, role, team_id } = body;
      if (!email || !full_name || !role) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate random password
      const tempPassword = crypto.randomUUID().slice(0, 12) + "Aa1!";

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) throw createErr;

      // Update profile with team
      if (team_id) {
        await admin.from("profiles").update({ team_id, full_name }).eq("id", newUser.user.id);
      } else {
        await admin.from("profiles").update({ full_name }).eq("id", newUser.user.id);
      }

      // Assign role
      await admin.from("user_roles").insert({ user_id: newUser.user.id, role });

      return new Response(JSON.stringify({ 
        success: true, 
        user_id: newUser.user.id, 
        temp_password: tempPassword 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent self-delete
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Нельзя удалить самого себя" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if target is admin and if they're the last admin
      const { data: targetRole } = await admin.from("user_roles").select("role").eq("user_id", user_id).single();
      if (targetRole?.role === "admin") {
        const { count } = await admin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
        if ((count ?? 0) <= 1) {
          return new Response(JSON.stringify({ error: "Нельзя удалить последнего администратора" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Soft delete: deactivate profile
      await admin.from("profiles").update({ is_active: false }).eq("id", user_id);
      
      // Disable auth user (so they can't log in)
      await admin.auth.admin.updateUserById(user_id, { ban_duration: "876600h" }); // ~100 years

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
