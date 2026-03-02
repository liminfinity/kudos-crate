import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LLM_BASE_URL = "http://84.54.30.173:8000";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { scope, data_summary } = await req.json();

    const scopeInstructions: Record<string, string> = {
      employee: `Ты HR-аналитик. На основе агрегированных метрик сотрудника сформируй 3-5 персональных рекомендаций по развитию.
Учитывай: количество полученных отзывов, баланс позитивных/негативных, частые подкатегории, уровень вовлечённости.
Формулируй конструктивно, без обвинений, в деловом стиле. Отмечай сильные стороны.`,
      team: `Ты HR-аналитик. На основе агрегированных метрик команды сформируй 3-5 рекомендаций для руководителя.
Учитывай: индекс удовлетворённости, вовлечённость, тренды настроения, проблемные области.
Предлагай конкретные действия: встречи, изменения процессов, внимание к перегрузу.`,
      company: `Ты HR-аналитик. На основе агрегированных метрик компании сформируй 3-5 стратегических рекомендаций.
Учитывай: общий CSI, распределение по командам, тренды, уровень вовлечённости.
Предлагай системные улучшения коммуникации и атмосферы.`,
    };

    const systemPrompt = `${scopeInstructions[scope] || scopeInstructions.company}

Не раскрывай конфиденциальные данные конкретных сотрудников.
Ответ на русском языке.
Формат ответа: пронумерованный список рекомендаций с кратким пояснением каждой.`;

    const prompt = `${systemPrompt}\n\nВот агрегированные данные:\n${JSON.stringify(data_summary, null, 2)}\n\nСформируй рекомендации.`;

    const response = await fetch(`${LLM_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("LLM API error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.answer || data.response || data.text || data.content || data.result || "Нет рекомендаций";

    return new Response(JSON.stringify({ recommendations: text, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommendations error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
