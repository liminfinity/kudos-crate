import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LLM_BASE_URL = "http://84.54.30.173:8000";

const PAGE_CONTEXT: Record<string, string> = {
  "/feedback/new": "Пользователь на странице создания отзыва. Помоги составить конструктивный отзыв. Объясни, что текст будет автоматически проверен на орфографию и тон.",
  "/kudos/new": "Пользователь на странице Благодарностей. Помоги выразить признательность коллеге.",
  "/mood": "Пользователь на странице «Состояние атмосферы». CSI = (Позитивные - Негативные) / Всего. Помоги интерпретировать данные.",
  "/dashboard": "Пользователь на странице «Аналитика взаимодействий». Здесь: распределение по тональности, топ подкатегорий, временная линия, тепловая карта.",
  "/kudos/dashboard": "Пользователь на странице «Благодарности (обзор)». Help Index = количество благодарностей сотрудника / среднее по компании.",
  "/satisfaction": "Пользователь на странице «Удовлетворённость команды». Satisfaction Index = (Позитивные / Всего) * 100%. Critical Incidents не учитываются. Есть фильтры по периоду, команде, сотруднику. Гистограмма по сотрудникам с цветовой градацией: ≥75% зелёный, 50-75% нейтральный, <50% красный.",
  "/engagement": "Пользователь на странице «Вовлечённость сотрудников». Engagement Score = weighted(feedback_activity × 0.5, kudos_activity × 0.2, survey_completion × 0.3). Scatter plot: X=вовлечённость, Y=удовлетворённость, размер=полученные отзывы. Типы: активный+позитивный, активный+конфликтный, тихая звезда, пассивный.",
  "/recommendations": "Пользователь на странице «Рекомендации». AI генерирует персональные рекомендации для сотрудника, руководителя или компании на основе агрегированных метрик за 6 месяцев.",
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

    // Build a single prompt from system + chat messages
    const chatHistory = (messages || [])
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "Пользователь" : "Ассистент"}: ${m.content}`)
      .join("\n");

    const prompt = `${systemPrompt}\n\n${chatHistory ? `История диалога:\n${chatHistory}\n\n` : ""}Ответь на последнее сообщение пользователя.`;

    const response = await fetch(`${LLM_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("LLM API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI-ассистента" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.answer || data.response || data.text || data.content || data.result || "Нет ответа";

    // Return as a non-streaming JSON response
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
