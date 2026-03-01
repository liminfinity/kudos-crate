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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { cycleId } = await req.json();
    if (!cycleId) throw new Error("cycleId required");

    // Load cycle settings
    const { data: cycle, error: cycErr } = await supabase
      .from("review_360_cycles")
      .select("*")
      .eq("id", cycleId)
      .single();
    if (cycErr || !cycle) throw new Error("Cycle not found");

    const requiredPerUser = cycle.required_reviews_per_user || 3;
    const maxPerReviewer = cycle.max_assignments_per_reviewer || 4;

    // Load all active users with their teams
    const { data: users } = await supabase
      .from("profiles")
      .select("id, team_id")
      .eq("is_active", true);
    if (!users || users.length < 2) throw new Error("Not enough users");

    // Load existing assignments from previous cycles to avoid repeats
    const { data: prevAssignments } = await supabase
      .from("review_360_assignments")
      .select("reviewer_user_id, reviewee_user_id")
      .neq("cycle_id", cycleId);
    const prevPairs = new Set(
      (prevAssignments || []).map((a: any) => `${a.reviewer_user_id}:${a.reviewee_user_id}`)
    );

    // Load shared episodes for weighting
    const { data: feedback } = await supabase
      .from("feedback")
      .select("from_user_id, to_user_id");
    const interactionCount = new Map<string, number>();
    (feedback || []).forEach((f: any) => {
      const key = `${f.from_user_id}:${f.to_user_id}`;
      interactionCount.set(key, (interactionCount.get(key) || 0) + 1);
    });

    // Build assignment graph
    const reviewCountReceived = new Map<string, number>(); // how many reviews each user receives
    const reviewCountGiven = new Map<string, number>(); // how many reviews each user gives
    const assignments: { reviewer_user_id: string; reviewee_user_id: string }[] = [];

    users.forEach((u) => {
      reviewCountReceived.set(u.id, 0);
      reviewCountGiven.set(u.id, 0);
    });

    // Score function: higher = better candidate
    function score(reviewerId: string, revieweeId: string): number {
      if (reviewerId === revieweeId) return -Infinity;
      const reviewer = users!.find((u) => u.id === reviewerId);
      const reviewee = users!.find((u) => u.id === revieweeId);
      let s = Math.random() * 10; // base randomness
      // Same team bonus
      if (reviewer?.team_id && reviewer.team_id === reviewee?.team_id) s += 30;
      // Interaction bonus
      const interactions = interactionCount.get(`${reviewerId}:${revieweeId}`) || 0;
      s += interactions * 5;
      // Penalty for previous pair
      if (prevPairs.has(`${reviewerId}:${revieweeId}`)) s -= 20;
      return s;
    }

    // Greedy assignment: ensure each user gets at least requiredPerUser reviews
    // Iterate multiple rounds
    for (let round = 0; round < requiredPerUser + 2; round++) {
      // Find users who still need more reviews
      const needMore = users.filter(
        (u) => (reviewCountReceived.get(u.id) || 0) < requiredPerUser
      );
      if (needMore.length === 0) break;

      for (const reviewee of needMore) {
        if ((reviewCountReceived.get(reviewee.id) || 0) >= requiredPerUser) continue;

        // Find eligible reviewers
        const candidates = users
          .filter((u) => {
            if (u.id === reviewee.id) return false;
            if ((reviewCountGiven.get(u.id) || 0) >= maxPerReviewer) return false;
            // Check not already assigned
            if (assignments.some((a) => a.reviewer_user_id === u.id && a.reviewee_user_id === reviewee.id)) return false;
            return true;
          })
          .map((u) => ({ id: u.id, score: score(u.id, reviewee.id) }))
          .sort((a, b) => b.score - a.score);

        if (candidates.length > 0) {
          const chosen = candidates[0];
          assignments.push({
            reviewer_user_id: chosen.id,
            reviewee_user_id: reviewee.id,
          });
          reviewCountReceived.set(reviewee.id, (reviewCountReceived.get(reviewee.id) || 0) + 1);
          reviewCountGiven.set(chosen.id, (reviewCountGiven.get(chosen.id) || 0) + 1);
        }
      }
    }

    // Insert assignments
    if (assignments.length > 0) {
      const toInsert = assignments.map((a) => ({
        cycle_id: cycleId,
        reviewer_user_id: a.reviewer_user_id,
        reviewee_user_id: a.reviewee_user_id,
        status: "not_started",
      }));

      const { error: insertErr } = await supabase
        .from("review_360_assignments")
        .insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        assignments_created: assignments.length,
        users_count: users.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
