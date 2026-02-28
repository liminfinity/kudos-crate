import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Create demo users
    const users = [
      { email: "admin@demo.com", password: "admin123", name: "Алексей Админов", role: "admin" },
      { email: "hr@demo.com", password: "hr123", name: "Елена Кадрова", role: "hr" },
      { email: "manager@demo.com", password: "manager123", name: "Игорь Лидеров", role: "manager" },
      { email: "employee1@demo.com", password: "emp123", name: "Анна Разработчик", role: "employee" },
      { email: "employee2@demo.com", password: "emp123", name: "Дмитрий Фронтенд", role: "employee" },
      { email: "employee3@demo.com", password: "emp123", name: "Мария Продуктова", role: "employee" },
    ];

    const userIds: Record<string, string> = {};

    for (const u of users) {
      // Check if user exists
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(eu => eu.email === u.email);
      
      if (existing) {
        userIds[u.email] = existing.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (error) {
          console.error(`Error creating user ${u.email}:`, error);
          continue;
        }
        userIds[u.email] = data.user.id;
      }
    }

    // Create teams
    const teamNames = ["Backend", "Frontend", "Product"];
    const teamIds: Record<string, string> = {};
    
    for (const name of teamNames) {
      const { data: existing } = await admin.from("teams").select("id").eq("name", name).maybeSingle();
      if (existing) {
        teamIds[name] = existing.id;
      } else {
        const { data } = await admin.from("teams").insert({ name }).select("id").single();
        if (data) teamIds[name] = data.id;
      }
    }

    // Set manager for Backend team
    if (teamIds["Backend"] && userIds["manager@demo.com"]) {
      await admin.from("teams").update({ manager_user_id: userIds["manager@demo.com"] }).eq("id", teamIds["Backend"]);
    }

    // Assign roles
    for (const u of users) {
      if (!userIds[u.email]) continue;
      const { data: existing } = await admin.from("user_roles").select("id").eq("user_id", userIds[u.email]).maybeSingle();
      if (!existing) {
        await admin.from("user_roles").insert({ user_id: userIds[u.email], role: u.role });
      }
    }

    // Update profiles with teams
    const teamAssign: Record<string, string> = {
      "manager@demo.com": "Backend",
      "employee1@demo.com": "Backend",
      "employee2@demo.com": "Frontend",
      "employee3@demo.com": "Product",
      "hr@demo.com": "Product",
    };
    for (const [email, team] of Object.entries(teamAssign)) {
      if (userIds[email] && teamIds[team]) {
        await admin.from("profiles").update({ team_id: teamIds[team] }).eq("id", userIds[email]);
      }
    }

    // Update profile full_name from metadata
    for (const u of users) {
      if (userIds[u.email]) {
        await admin.from("profiles").update({ full_name: u.name }).eq("id", userIds[u.email]);
      }
    }

    // Create subcategories
    const subcats = [
      { name: "Помог разобраться", sentiment: "positive", sort_order: 1 },
      { name: "Быстро ответил", sentiment: "positive", sort_order: 2 },
      { name: "Проявил инициативу", sentiment: "positive", sort_order: 3 },
      { name: "Качественно сделал", sentiment: "positive", sort_order: 4 },
      { name: "Командная работа", sentiment: "positive", sort_order: 5 },
      { name: "Игнорировал сообщения", sentiment: "negative", sort_order: 6 },
      { name: "Сорвал сроки", sentiment: "negative", sort_order: 7 },
      { name: "Не держал в курсе", sentiment: "negative", sort_order: 8 },
      { name: "Низкое качество", sentiment: "negative", sort_order: 9 },
      { name: "Конфликтность", sentiment: "negative", sort_order: 10 },
    ];

    const subcatIds: Record<string, string> = {};
    for (const sc of subcats) {
      const { data: existing } = await admin.from("subcategories").select("id").eq("name", sc.name).maybeSingle();
      if (existing) {
        subcatIds[sc.name] = existing.id;
      } else {
        const { data } = await admin.from("subcategories").insert(sc).select("id").single();
        if (data) subcatIds[sc.name] = data.id;
      }
    }

    // Create work episodes across last 6 months
    const episodeTitles = [
      "Спринт 10", "Спринт 11", "Спринт 12", "Спринт 13", "Спринт 14", "Спринт 15",
      "Ретро Q3", "Ретро Q4", "Релиз 1.0", "Релиз 1.1", "Релиз 1.2",
      "Хакатон 2025", "Код-ревью инициатива", "Миграция БД",
      "Планирование Q1", "Презентация клиенту",
    ];

    const episodeIds: string[] = [];
    const now = new Date();
    
    for (let i = 0; i < episodeTitles.length; i++) {
      const daysAgo = Math.floor((i / episodeTitles.length) * 180);
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      const dateStr = d.toISOString().split("T")[0];
      
      const { data: existing } = await admin.from("work_episodes").select("id").eq("title", episodeTitles[i]).maybeSingle();
      if (existing) {
        episodeIds.push(existing.id);
      } else {
        const creator = Object.values(userIds)[Math.floor(Math.random() * Object.values(userIds).length)];
        const { data } = await admin.from("work_episodes").insert({
          title: episodeTitles[i],
          date: dateStr,
          created_by: creator,
        }).select("id").single();
        if (data) episodeIds.push(data.id);
      }
    }

    // Generate feedback (100+ entries)
    const employeeEmails = ["employee1@demo.com", "employee2@demo.com", "employee3@demo.com", "manager@demo.com", "hr@demo.com"];
    const positiveSubNames = ["Помог разобраться", "Быстро ответил", "Проявил инициативу", "Качественно сделал", "Командная работа"];
    const negativeSubNames = ["Игнорировал сообщения", "Сорвал сроки", "Не держал в курсе", "Низкое качество", "Конфликтность"];

    const positiveComments = [
      "Отлично помог с решением сложной технической проблемы",
      "Быстро среагировал на запрос и предоставил информацию",
      "Проявил инициативу и предложил улучшения для процесса",
      "Сделал задачу качественно и в срок, молодец!",
      "Отличная командная работа при решении блокера",
      "Всегда готов прийти на помощь коллегам, спасибо",
      "Провёл отличное код-ревью, очень полезные комментарии",
      "Помог новому сотруднику быстро адаптироваться в команде",
      "Предложил эффективное решение для оптимизации производительности",
      "Организовал полезную сессию обмена знаниями для команды",
    ];

    const negativeComments = [
      "Не ответил на сообщение в течение двух рабочих дней",
      "Задача была сдана с опозданием на неделю без предупреждения",
      "Не информировал команду об изменениях в требованиях",
      "Код содержал множество багов, пришлось переделывать",
      "Конфликтовал с коллегами на совещании вместо конструктивного диалога",
      "Игнорировал просьбы о помощи от других членов команды",
      "Сроки были сорваны и никто не был поставлен в известность",
      "Качество документации оставляет желать лучшего, трудно разобраться",
      "Не согласовал изменения с командой перед внедрением",
      "Критиковал без предложения альтернативных решений проблемы",
    ];

    let feedbackCreated = 0;

    for (let i = 0; i < 120; i++) {
      const fromEmail = employeeEmails[Math.floor(Math.random() * employeeEmails.length)];
      let toEmail = employeeEmails[Math.floor(Math.random() * employeeEmails.length)];
      while (toEmail === fromEmail) {
        toEmail = employeeEmails[Math.floor(Math.random() * employeeEmails.length)];
      }

      const fromId = userIds[fromEmail];
      const toId = userIds[toEmail];
      const epId = episodeIds[Math.floor(Math.random() * episodeIds.length)];
      
      if (!fromId || !toId || !epId) continue;

      const isPositive = Math.random() > 0.35; // 65% positive
      const sentiment = isPositive ? "positive" : "negative";
      const comments = isPositive ? positiveComments : negativeComments;
      const comment = comments[Math.floor(Math.random() * comments.length)];

      // Check uniqueness
      const { data: existFb } = await admin.from("feedback")
        .select("id")
        .eq("from_user_id", fromId)
        .eq("to_user_id", toId)
        .eq("episode_id", epId)
        .maybeSingle();
      
      if (existFb) continue;

      const daysAgo = Math.floor(Math.random() * 180);
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - daysAgo);

      const { data: fb, error: fbErr } = await admin.from("feedback").insert({
        episode_id: epId,
        from_user_id: fromId,
        to_user_id: toId,
        sentiment,
        comment,
        created_at: createdAt.toISOString(),
      }).select("id").single();

      if (fbErr) { console.error("Feedback error:", fbErr); continue; }

      // Assign 1-3 subcategories
      const subNames = isPositive ? positiveSubNames : negativeSubNames;
      const numSubs = Math.floor(Math.random() * 3) + 1;
      const shuffled = [...subNames].sort(() => Math.random() - 0.5).slice(0, numSubs);
      
      for (const sn of shuffled) {
        if (subcatIds[sn] && fb) {
          await admin.from("feedback_subcategories").insert({
            feedback_id: fb.id,
            subcategory_id: subcatIds[sn],
          });
        }
      }
      feedbackCreated++;
    }

    return new Response(
      JSON.stringify({ success: true, feedbackCreated, usersCreated: Object.keys(userIds).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
