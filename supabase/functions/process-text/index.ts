import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LLM_BASE_URL = "http://84.54.30.173:8000";

const SYSTEM_PROMPTS: Record<string, string> = {
  feedback: `Ты модератор корпоративной HR-платформы. Задача:
- Удалить мат и оскорбления
- Исправить орфографию и пунктуацию
- Смягчить агрессивные формулировки, сохранив смысл
- Сделать текст профессиональным и нейтральным
- Если текст бессмысленный (набор символов, спам) — вернуть status INVALID

Верни строго JSON:
{"status":"OK","processed_text":"...","toxicity_score":0.0,"was_modified":false}
toxicity_score от 0 до 1 (0 = чисто, 1 = крайне токсично).
was_modified = true если текст был изменён.
Не добавляй ничего кроме JSON.`,

  critical: `Ты модератор корпоративной HR-платформы. Контекст: серьёзное нарушение (Critical Incident).
- НЕ смягчай серьёзные обвинения — сохрани юридическую точность
- Только убери мат и оскорбления
- Исправь орфографию
- Если текст бессмысленный — вернуть status INVALID

Верни строго JSON:
{"status":"OK","processed_text":"...","toxicity_score":0.0,"was_modified":false}`,

  kudos: `Ты модератор корпоративной HR-платформы. Контекст: благодарность коллеге (Kudos).
- Лёгкая редактура
- Подчеркни позитив
- Сохрани дружелюбный стиль
- Исправь ошибки
- Если текст бессмысленный — вернуть status INVALID

Верни строго JSON:
{"status":"OK","processed_text":"...","toxicity_score":0.0,"was_modified":false}`,

  survey: `Ты модератор корпоративной HR-платформы. Контекст: заполнение опроса.
- Исправь ошибки
- Структурируй длинные тексты
- Не меняй смысл
- Если текст бессмысленный — вернуть status INVALID

Верни строго JSON:
{"status":"OK","processed_text":"...","toxicity_score":0.0,"was_modified":false}`,

  "manager-diary": `Ты модератор корпоративной HR-платформы. Контекст: дневник руководителя.
- Исправь ошибки
- Структурируй текст
- Сохрани управленческий тон
- Если текст бессмысленный — вернуть status INVALID

Верни строго JSON:
{"status":"OK","processed_text":"...","toxicity_score":0.0,"was_modified":false}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, context } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 3) {
      return new Response(JSON.stringify({
        status: "OK",
        processed_text: text || "",
        toxicity_score: 0,
        was_modified: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = SYSTEM_PROMPTS[context] || SYSTEM_PROMPTS.feedback;

    const prompt = `${systemPrompt}\n\nТекст пользователя:\n${text}`;

    const response = await fetch(`${LLM_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("LLM API error:", response.status, t);
      // Fallback: return original text
      return new Response(JSON.stringify({
        status: "OK",
        processed_text: text,
        toxicity_score: 0,
        was_modified: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    // The external LLM may return the answer in different fields — try common ones
    const raw = data.answer || data.response || data.text || data.content || data.result || JSON.stringify(data);

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      result = {
        status: "OK",
        processed_text: text,
        toxicity_score: 0,
        was_modified: false,
      };
    }

    // Validate result structure
    if (!result.status) result.status = "OK";
    if (!result.processed_text) result.processed_text = text;
    if (typeof result.toxicity_score !== "number") result.toxicity_score = 0;
    if (typeof result.was_modified !== "boolean") result.was_modified = false;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
