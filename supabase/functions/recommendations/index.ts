import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
          { role: "user", content: `Вот агрегированные данные:\n${JSON.stringify(data_summary, null, 2)}\n\nСформируй рекомендации.` },
        ],
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
      return new Response(JSON.stringify({ error: "Ошибка AI" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "Нет рекомендаций";

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
