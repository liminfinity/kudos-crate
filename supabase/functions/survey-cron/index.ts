import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const today = now.toISOString().split('T')[0];

  try {
    // 1. Check if we need to create half-year cycle
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11
    const halfLabel = currentMonth < 6 ? `${currentYear}-H1` : `${currentYear}-H2`;
    const halfStart = currentMonth < 6 ? `${currentYear}-01-01` : `${currentYear}-07-01`;
    const halfEnd = currentMonth < 6 ? `${currentYear}-06-30` : `${currentYear}-12-31`;

    // Check if template exists
    let { data: halfTemplate } = await supabase
      .from('survey_templates')
      .select('id')
      .eq('type', 'half_year_employee')
      .eq('is_active', true)
      .single();

    if (!halfTemplate) {
      // Create template
      const { data: newTemplate } = await supabase
        .from('survey_templates')
        .insert({ name: 'Полугодовой срез', type: 'half_year_employee', schema_json: {} })
        .select('id')
        .single();
      halfTemplate = newTemplate;
    }

    if (halfTemplate) {
      // Check if cycle exists
      const { data: existingCycle } = await supabase
        .from('survey_cycles')
        .select('id')
        .eq('label', halfLabel)
        .eq('template_id', halfTemplate.id)
        .maybeSingle();

      if (!existingCycle) {
        // Determine open_from date (1st of the half)
        const openFrom = new Date(halfStart + 'T00:00:00Z');
        // Only create if we're within the period
        if (now >= openFrom) {
          const dueDate = new Date(openFrom);
          dueDate.setDate(dueDate.getDate() + 14); // 14 days to fill

          const { data: newCycle } = await supabase
            .from('survey_cycles')
            .insert({
              template_id: halfTemplate.id,
              label: halfLabel,
              period_start: halfStart,
              period_end: halfEnd,
              open_from: openFrom.toISOString(),
              due_date: dueDate.toISOString(),
              status: 'open',
            })
            .select('id')
            .single();

          if (newCycle) {
            // Create assignments for all active users
            const { data: activeProfiles } = await supabase
              .from('profiles')
              .select('id, team_id')
              .eq('is_active', true);

            if (activeProfiles && activeProfiles.length > 0) {
              const assignments = activeProfiles.map(p => ({
                cycle_id: newCycle.id,
                user_id: p.id,
                team_id: p.team_id,
                status: 'not_started',
              }));
              await supabase.from('survey_assignments').insert(assignments);
            }
          }
        }
      }
    }

    // 2. Check bi-monthly manager diary
    const biMonthIndex = Math.floor(currentMonth / 2); // 0-5
    const biStart = `${currentYear}-${String(biMonthIndex * 2 + 1).padStart(2, '0')}-01`;
    const biEndMonth = biMonthIndex * 2 + 2;
    const biEndDate = new Date(currentYear, biEndMonth, 0); // Last day of 2nd month
    const biEnd = biEndDate.toISOString().split('T')[0];
    const biLabel = `${currentYear}-${String(biMonthIndex * 2 + 1).padStart(2, '0')}/${String(biEndMonth).padStart(2, '0')}`;

    let { data: diaryTemplate } = await supabase
      .from('survey_templates')
      .select('id')
      .eq('type', 'bi_month_manager')
      .eq('is_active', true)
      .single();

    if (!diaryTemplate) {
      const { data: newTemplate } = await supabase
        .from('survey_templates')
        .insert({ name: 'Дневник руководителя', type: 'bi_month_manager', schema_json: {} })
        .select('id')
        .single();
      diaryTemplate = newTemplate;
    }

    if (diaryTemplate) {
      const { data: existingDiary } = await supabase
        .from('survey_cycles')
        .select('id')
        .eq('label', biLabel)
        .eq('template_id', diaryTemplate.id)
        .maybeSingle();

      if (!existingDiary) {
        const openFrom = new Date(biStart + 'T00:00:00Z');
        if (now >= openFrom) {
          const dueDate = new Date(biEndDate);
          dueDate.setDate(dueDate.getDate() + 7);

          const { data: newCycle } = await supabase
            .from('survey_cycles')
            .insert({
              template_id: diaryTemplate.id,
              label: biLabel,
              period_start: biStart,
              period_end: biEnd,
              open_from: openFrom.toISOString(),
              due_date: dueDate.toISOString(),
              status: 'open',
            })
            .select('id')
            .single();

          if (newCycle) {
            // Assign to team managers
            const { data: teamsWithManagers } = await supabase
              .from('teams')
              .select('id, manager_user_id')
              .not('manager_user_id', 'is', null);

            if (teamsWithManagers) {
              const assignments = teamsWithManagers
                .filter(t => t.manager_user_id)
                .map(t => ({
                  cycle_id: newCycle.id,
                  user_id: t.manager_user_id!,
                  team_id: t.id,
                  status: 'not_started',
                }));
              if (assignments.length > 0) {
                await supabase.from('survey_assignments').insert(assignments);
              }
            }
          }
        }
      }
    }

    // 3. Mark overdue assignments
    const { data: openCycles } = await supabase
      .from('survey_cycles')
      .select('id, due_date')
      .eq('status', 'open');

    if (openCycles) {
      for (const cycle of openCycles) {
        if (new Date(cycle.due_date) < now) {
          await supabase
            .from('survey_assignments')
            .update({ status: 'overdue' })
            .eq('cycle_id', cycle.id)
            .in('status', ['not_started', 'in_progress']);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, timestamp: now.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
