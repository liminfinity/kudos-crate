import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function daysAgo(d: number) { const dt = new Date(); dt.setDate(dt.getDate() - d); return dt; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // ─── 1. Users (30 employees + managers + hr + admin) ─────────
    const userDefs = [
      { email: "admin@demo.com", password: "admin123", name: "Алексей Админов", role: "admin" },
      { email: "hr@demo.com", password: "hr123", name: "Елена Кадрова", role: "hr" },
      { email: "hr2@demo.com", password: "hr123", name: "Ольга Персоналова", role: "hr" },
      { email: "manager1@demo.com", password: "mgr123", name: "Игорь Лидеров", role: "manager" },
      { email: "manager2@demo.com", password: "mgr123", name: "Наталья Руководева", role: "manager" },
      { email: "manager3@demo.com", password: "mgr123", name: "Сергей Директоров", role: "manager" },
      ...Array.from({ length: 30 }, (_, i) => ({
        email: `emp${i + 1}@demo.com`,
        password: "emp123",
        name: [
          "Анна Разработчик", "Дмитрий Фронтенд", "Мария Продуктова", "Павел Бэкендов",
          "Ирина Тестерова", "Олег Девопсов", "Светлана Дизайнова", "Артём Аналитиков",
          "Юлия Маркетолог", "Максим Архитектов", "Екатерина Скрамова", "Николай Сетевой",
          "Алина Мобильная", "Виктор Базданов", "Татьяна Проджектова", "Роман Инфраструктур",
          "Оксана Контентова", "Андрей Секьюрити", "Валерия Интерфейсова", "Кирилл Интеграторов",
          "Людмила Автоматова", "Денис Оптимизатор", "Марина Релизова", "Степан Рефакторов",
          "Полина Метрикова", "Григорий Мониторов", "Вероника Документова", "Тимур Деплойщиков",
          "Дарья Фичерова", "Илья Бэклогов",
        ][i],
        role: "employee",
      })),
    ];

    const userIds: Record<string, string> = {};
    const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });

    for (const u of userDefs) {
      const existing = existingUsers?.users?.find(eu => eu.email === u.email);
      if (existing) {
        userIds[u.email] = existing.id;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: u.email, password: u.password, email_confirm: true,
          user_metadata: { full_name: u.name },
        });
        if (error) { console.error(`User ${u.email}:`, error); continue; }
        userIds[u.email] = data.user.id;
      }
    }

    // ─── 2. Teams ────────────────────────────────────────────────
    const teamDefs = [
      { name: "Backend", manager: "manager1@demo.com" },
      { name: "Frontend", manager: "manager2@demo.com" },
      { name: "Product", manager: "manager3@demo.com" },
      { name: "DevOps", manager: "manager1@demo.com" },
      { name: "QA", manager: "manager2@demo.com" },
    ];
    const teamIds: Record<string, string> = {};

    for (const t of teamDefs) {
      const { data: existing } = await admin.from("teams").select("id").eq("name", t.name).maybeSingle();
      if (existing) { teamIds[t.name] = existing.id; }
      else {
        const { data } = await admin.from("teams").insert({ name: t.name, manager_user_id: userIds[t.manager] || null }).select("id").single();
        if (data) teamIds[t.name] = data.id;
      }
    }

    // ─── 3. Roles & Profiles ─────────────────────────────────────
    const teamNames = Object.keys(teamIds);
    for (const u of userDefs) {
      if (!userIds[u.email]) continue;
      const uid = userIds[u.email];

      // Role
      const { data: existRole } = await admin.from("user_roles").select("id").eq("user_id", uid).maybeSingle();
      if (!existRole) await admin.from("user_roles").insert({ user_id: uid, role: u.role });

      // Profile team + name
      const team = u.role === "admin" ? null : pick(teamNames);
      await admin.from("profiles").update({
        full_name: u.name,
        ...(team ? { team_id: teamIds[team] } : {}),
      }).eq("id", uid);
    }

    // ─── 4. Subcategories ────────────────────────────────────────
    const subcats = [
      { name: "Помог разобраться", sentiment: "positive", sort_order: 1 },
      { name: "Быстро ответил", sentiment: "positive", sort_order: 2 },
      { name: "Проявил инициативу", sentiment: "positive", sort_order: 3 },
      { name: "Качественно сделал", sentiment: "positive", sort_order: 4 },
      { name: "Командная работа", sentiment: "positive", sort_order: 5 },
      { name: "Менторство", sentiment: "positive", sort_order: 6 },
      { name: "Игнорировал сообщения", sentiment: "negative", sort_order: 7 },
      { name: "Сорвал сроки", sentiment: "negative", sort_order: 8 },
      { name: "Не держал в курсе", sentiment: "negative", sort_order: 9 },
      { name: "Низкое качество", sentiment: "negative", sort_order: 10 },
      { name: "Конфликтность", sentiment: "negative", sort_order: 11 },
      { name: "Некомандный игрок", sentiment: "negative", sort_order: 12 },
    ];
    const subcatIds: Record<string, string> = {};
    for (const sc of subcats) {
      const { data: existing } = await admin.from("subcategories").select("id").eq("name", sc.name).maybeSingle();
      if (existing) { subcatIds[sc.name] = existing.id; }
      else {
        const { data } = await admin.from("subcategories").insert(sc).select("id").single();
        if (data) subcatIds[sc.name] = data.id;
      }
    }

    // ─── 5. Work Episodes (25+) ──────────────────────────────────
    const episodeTitles = [
      "Спринт 10", "Спринт 11", "Спринт 12", "Спринт 13", "Спринт 14", "Спринт 15",
      "Спринт 16", "Спринт 17", "Спринт 18", "Спринт 19", "Спринт 20",
      "Ретро Q3", "Ретро Q4", "Ретро Q1",
      "Релиз 1.0", "Релиз 1.1", "Релиз 1.2", "Релиз 2.0",
      "Хакатон 2025", "Код-ревью инициатива", "Миграция БД",
      "Планирование Q1", "Презентация клиенту", "Аудит безопасности",
      "Онбординг новичков",
    ];
    const episodeIds: string[] = [];
    const allUserIds = Object.values(userIds);

    for (let i = 0; i < episodeTitles.length; i++) {
      const d = Math.floor((i / episodeTitles.length) * 200);
      const dateStr = daysAgo(d).toISOString().split("T")[0];
      const { data: existing } = await admin.from("work_episodes").select("id").eq("title", episodeTitles[i]).maybeSingle();
      if (existing) { episodeIds.push(existing.id); }
      else {
        const { data } = await admin.from("work_episodes").insert({
          title: episodeTitles[i], date: dateStr, created_by: pick(allUserIds),
        }).select("id").single();
        if (data) episodeIds.push(data.id);
      }
    }

    // ─── 6. Feedback (200+) ──────────────────────────────────────
    const posComments = [
      "Отлично помог с решением сложной технической проблемы",
      "Быстро среагировал на запрос и предоставил информацию",
      "Проявил инициативу и предложил улучшения для процесса",
      "Сделал задачу качественно и в срок, молодец!",
      "Отличная командная работа при решении блокера",
      "Всегда готов прийти на помощь коллегам",
      "Провёл отличное код-ревью, очень полезные комментарии",
      "Помог новому сотруднику быстро адаптироваться",
      "Предложил эффективное решение для оптимизации",
      "Организовал полезную сессию обмена знаниями",
      "Отличная презентация для стейкхолдеров",
      "Взял на себя сложную задачу и справился великолепно",
    ];
    const negComments = [
      "Не ответил на сообщение в течение двух дней",
      "Задача сдана с опозданием без предупреждения",
      "Не информировал команду об изменениях в требованиях",
      "Код содержал множество багов, пришлось переделывать",
      "Конфликтовал с коллегами на совещании",
      "Игнорировал просьбы о помощи от команды",
      "Сроки сорваны, никто не поставлен в известность",
      "Качество документации оставляет желать лучшего",
      "Не согласовал изменения с командой перед внедрением",
      "Критиковал без предложения альтернативных решений",
    ];
    const posSubNames = Object.keys(subcatIds).filter(n => subcats.find(s => s.name === n)?.sentiment === "positive");
    const negSubNames = Object.keys(subcatIds).filter(n => subcats.find(s => s.name === n)?.sentiment === "negative");

    let feedbackCreated = 0;
    // Create archetypes: some users get more positive, some more negative
    const archetypes: Record<string, number> = {}; // email -> positive probability
    for (const u of userDefs) {
      if (u.role === "employee") {
        const r = Math.random();
        if (r < 0.15) archetypes[u.email] = 0.2; // "conflicting" - mostly negative
        else if (r < 0.3) archetypes[u.email] = 0.95; // "star" - almost all positive
        else if (r < 0.45) archetypes[u.email] = 0.4; // "active but negative"
        else archetypes[u.email] = 0.7; // normal
      } else {
        archetypes[u.email] = 0.75;
      }
    }

    for (let i = 0; i < 250; i++) {
      const fromEmail = pick(Object.keys(userIds));
      let toEmail = pick(Object.keys(userIds));
      let attempts = 0;
      while (toEmail === fromEmail && attempts < 10) { toEmail = pick(Object.keys(userIds)); attempts++; }
      if (toEmail === fromEmail) continue;

      const fromId = userIds[fromEmail];
      const toId = userIds[toEmail];
      const epId = pick(episodeIds);
      if (!fromId || !toId || !epId) continue;

      const { data: existFb } = await admin.from("feedback")
        .select("id").eq("from_user_id", fromId).eq("to_user_id", toId).eq("episode_id", epId).maybeSingle();
      if (existFb) continue;

      const posProb = archetypes[toEmail] ?? 0.65;
      const isPositive = Math.random() < posProb;
      const sentiment = isPositive ? "positive" : "negative";
      const comment = pick(isPositive ? posComments : negComments);
      const createdAt = daysAgo(Math.floor(Math.random() * 200));
      const isCritical = !isPositive && Math.random() < 0.15;

      const { data: fb, error: fbErr } = await admin.from("feedback").insert({
        episode_id: epId, from_user_id: fromId, to_user_id: toId,
        sentiment, comment, is_critical: isCritical, created_at: createdAt.toISOString(),
      }).select("id").single();
      if (fbErr) { console.error("Feedback:", fbErr); continue; }

      const subs = pickN(isPositive ? posSubNames : negSubNames, Math.floor(Math.random() * 3) + 1);
      for (const sn of subs) {
        if (subcatIds[sn] && fb) {
          await admin.from("feedback_subcategories").insert({ feedback_id: fb.id, subcategory_id: subcatIds[sn] });
        }
      }
      feedbackCreated++;
    }

    // ─── 7. Kudos (80+) ─────────────────────────────────────────
    const kudosCategories = ["helped_understand", "emotional_support", "saved_deadline", "shared_expertise", "mentoring", "team_support"];
    const kudosComments = [
      "Спасибо за помощь с деплоем!", "Ты настоящий командный игрок",
      "Благодарю за менторство", "Выручил с дедлайном, супер!",
      "Отличная поддержка на ретро", "Помог разобраться в новом фреймворке",
      "Поддержал в сложный момент", "Спасибо за экспертизу!",
      null, null, // some without comments
    ];
    let kudosCreated = 0;
    for (let i = 0; i < 100; i++) {
      const fromEmail = pick(Object.keys(userIds));
      let toEmail = pick(Object.keys(userIds));
      while (toEmail === fromEmail) toEmail = pick(Object.keys(userIds));
      const { error } = await admin.from("kudos").insert({
        from_user_id: userIds[fromEmail], to_user_id: userIds[toEmail],
        category: pick(kudosCategories), comment: pick(kudosComments),
        created_at: daysAgo(Math.floor(Math.random() * 180)).toISOString(),
      });
      if (!error) kudosCreated++;
    }

    // ─── 8. Review 360 cycles + assignments ─────────────────────
    const managerIds = userDefs.filter(u => u.role === "manager" || u.role === "hr" || u.role === "admin").map(u => userIds[u.email]).filter(Boolean);

    // Closed cycle
    const { data: closedCycle } = await admin.from("review_360_cycles").insert({
      title: "Годовой 360 — 2025 H1", year: 2025, status: "closed",
      open_from: daysAgo(120).toISOString(), due_date: daysAgo(60).toISOString(),
      created_by: pick(managerIds),
    }).select("id").single();

    // Active cycle
    const { data: activeCycle } = await admin.from("review_360_cycles").insert({
      title: "Годовой 360 — 2025 H2", year: 2025, status: "published",
      open_from: daysAgo(14).toISOString(), due_date: daysAgo(-30).toISOString(),
      created_by: pick(managerIds),
    }).select("id").single();

    // Create assignments for both cycles
    const employeeIds = userDefs.filter(u => u.role === "employee").map(u => userIds[u.email]).filter(Boolean);

    for (const cycle of [closedCycle, activeCycle]) {
      if (!cycle) continue;
      const isClosed = cycle === closedCycle;
      const shuffled = [...employeeIds].sort(() => Math.random() - 0.5);

      for (let i = 0; i < Math.min(shuffled.length, 20); i++) {
        const reviewee = shuffled[i];
        const reviewers = pickN(allUserIds.filter(id => id !== reviewee), 3);
        for (const reviewer of reviewers) {
          const submitted = isClosed ? true : Math.random() < 0.4;
          const { data: assignment } = await admin.from("review_360_assignments").insert({
            cycle_id: cycle.id, reviewer_user_id: reviewer, reviewee_user_id: reviewee,
            status: submitted ? "submitted" : "not_started",
            submitted_at: submitted ? daysAgo(Math.floor(Math.random() * 30)).toISOString() : null,
          }).select("id").single();

          if (assignment && submitted) {
            await admin.from("review_360_responses").insert({
              assignment_id: assignment.id,
              answers_json: {
                strengths: pick(["Коммуникабельность", "Техническая экспертиза", "Лидерство", "Инициативность"]),
                weaknesses: pick(["Тайм-менеджмент", "Делегирование", "Документирование", "Обратная связь"]),
                rating: Math.floor(Math.random() * 3) + 3,
                comment: pick(["Отличный коллега, рад работать вместе", "Есть зоны роста, но в целом хорошо", "Нужно работать над коммуникацией"]),
              },
            });
          }
        }
      }
    }

    // ─── 9. Surveys ──────────────────────────────────────────────
    const halfYearTemplateId = "9e971ea3-5178-454f-a10c-485205b1fcb7";
    const leaderTemplateId = "8e3c1366-c538-408d-8be1-b5122729fb58";

    // Closed half-year survey
    const { data: closedSurvey } = await admin.from("survey_cycles").insert({
      label: "Полугодовой Q3–Q4 2025", template_id: halfYearTemplateId,
      status: "closed", period_start: "2025-07-01", period_end: "2025-12-31",
      open_from: daysAgo(90).toISOString(), due_date: daysAgo(60).toISOString(),
    }).select("id").single();

    // Active half-year survey
    const { data: activeSurvey } = await admin.from("survey_cycles").insert({
      label: "Полугодовой Q1–Q2 2026", template_id: halfYearTemplateId,
      status: "open", period_start: "2026-01-01", period_end: "2026-06-30",
      open_from: daysAgo(7).toISOString(), due_date: daysAgo(-30).toISOString(),
    }).select("id").single();

    // Create assignments
    for (const cycle of [closedSurvey, activeSurvey]) {
      if (!cycle) continue;
      const isClosed = cycle === closedSurvey;

      for (const empId of employeeIds.slice(0, 25)) {
        const submitted = isClosed ? Math.random() < 0.85 : Math.random() < 0.3;
        const status = submitted ? "submitted" : (Math.random() < 0.5 ? "in_progress" : "not_started");
        const { data: assignment } = await admin.from("survey_assignments").insert({
          cycle_id: cycle.id, user_id: empId,
          status, submitted_at: submitted ? daysAgo(Math.floor(Math.random() * 30)).toISOString() : null,
          started_at: status !== "not_started" ? daysAgo(Math.floor(Math.random() * 30) + 5).toISOString() : null,
        }).select("id").single();

        if (assignment && submitted) {
          await admin.from("survey_responses").insert({
            assignment_id: assignment.id,
            answers_json: {
              satisfaction: Math.floor(Math.random() * 5) + 1,
              engagement: Math.floor(Math.random() * 5) + 1,
              workload: pick(["low", "normal", "high", "overloaded"]),
              mood: pick(["great", "good", "ok", "bad"]),
              comment: pick(["Всё хорошо", "Есть вопросы по процессам", "Нужна поддержка руководителя", "Доволен текущей ситуацией", null]),
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats: { users: Object.keys(userIds).length, feedbackCreated, kudosCreated, episodes: episodeIds.length },
      }),
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
