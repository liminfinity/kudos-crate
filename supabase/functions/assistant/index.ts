import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGE_CONTEXT: Record<string, string> = {
  "/feedback/new": "Пользователь на странице создания отзыва. Помоги составить конструктивный отзыв. Объясни, что текст будет автоматически проверен на орфографию и тон.",
  "/kudos/new": "Пользователь на странице Благодарностей. Помоги выразить признательность коллеге.",
  "/mood": "Пользователь на странице «Состояние атмосферы». CSI = (Позитивные - Негативные) / Всего. Помоги интерпретировать данные.",
  "/dashboard": "Пользователь на странице «Аналитика взаимодействий». Здесь: распределение по тональности, топ подкатегорий, временная линия, тепловая карта.",
  "/kudos/dashboard": "Пользователь на странице «Благодарности (обзор)». Help Index = количество благодарностей сотрудника / среднее по компании.",
  "/surveys": "Пользователь на странице опросов. Объясни назначение полугодовых опросов и как их заполнять.",
  "/leader-diary": "Пользователь на странице дневника руководителя. Помоги структурировать наблюдения о команде.",
  "/incidents": "Пользователь на странице «Серьёзные сигналы» (только для HR/Admin). Объясни логику отслеживания значимых инцидентов.",
  "/analytics/half-year": "Пользователь на странице полугодовой аналитики. Помоги интерпретировать результаты опросов.",
  "/subcategories": "Пользователь на странице управления подкатегориями обратной связи.",
  "/admin/users": "Пользователь на странице управления пользователями (только Admin).",
  "/admin/teams": "Пользователь на странице управления командами (только Admin).",
  "/admin/episodes": "Пользователь на странице управления рабочими эпизодами (только Admin).",
};

const ROLE_RESTRICTIONS: Record<string, string> = {
  employee: "Пользователь — обычный сотрудник. НЕ раскрывай данные аналитических дашбордов, Critical Incidents, HR-данные. Помогай только с отзывами, kudos, опросами и общей навигацией.",
  manager: "Пользователь — руководитель. Может видеть аналитику своей команды, дневник руководителя, kudos аналитику. НЕ показывай Critical Incidents.",
  hr: "Пользователь — HR. Имеет доступ ко всей аналитике и Critical Incidents. Помогай интерпретировать данные.",
  admin: "Пользователь — администратор. Полный доступ ко всем функциям платформы.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { messages, user_role, current_page } = await req.json();

    const pageContext = PAGE_CONTEXT[current_page] || "Пользователь на неизвестной странице.";
    const roleRestriction = ROLE_RESTRICTIONS[user_role] || ROLE_RESTRICTIONS.employee;

    const systemPrompt = `Ты — МИРА, цифровой ассистент платформы «МИРА» — корпоративной системы обратной связи и развития команд.

Твой характер: дружелюбный, но профессиональный. Отвечай кратко и по делу. Используй эмодзи умеренно.

${roleRestriction}

Контекст текущей страницы: ${pageContext}

Правила:
- Отвечай на русском языке
- Не раскрывай конфиденциальные данные других сотрудников
- Не выдумывай данные — если не знаешь, скажи честно
- Помогай ориентироваться в платформе
- Объясняй метрики простым языком
- Если пользователь спрашивает о функциях, к которым у него нет доступа, вежливо объясни, что эта функция доступна для другой роли`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...(messages || []),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Требуется пополнение баланса AI" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI-ассистента" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
