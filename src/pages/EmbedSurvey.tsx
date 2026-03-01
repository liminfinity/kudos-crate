import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Standalone embed survey page — no AppLayout, no auth required
// Reuses the half-year survey structure

const STEPS = [
  'Общая информация',
  'Работа за 6 месяцев',
  'Оценка условий работы',
  'Рост и развитие',
  'Состояние и динамика',
  'Обратная связь',
  'Важное',
];

const DIFFICULTIES = [
  'Размытые требования/цели',
  'Высокая нагрузка/переработки',
  'Зависимости от других',
  'Нехватка знаний/опыта',
  'Сложности в коммуникации',
];

const WORK_CONDITIONS = [
  'Понимаю, что от меня ждут',
  'Хватает ресурсов для работы',
  'Понятна постановка задач',
  'Чувствую поддержку руководителя',
  'Атмосфера в команде',
  'Справедливость распределения нагрузки',
];

const LIKERT_OPTIONS = ['Полностью устраивает', 'Скорее да', 'Скорее нет', 'Не устраивает'];

const WELLBEING_OPTIONS = [
  'Стабильно, комфортно',
  'Рабочее состояние, но бывают сложности',
  'Часто чувствую напряжение или усталость',
  'Близок к выгоранию',
];

interface Answers {
  respondent_name: string;
  respondent_email: string;
  main_work: string;
  main_achievement: string;
  difficulties: string[];
  work_conditions: Record<string, string>;
  learned: string;
  want_to_develop: string;
  wellbeing: string;
  feedback_helps: string;
  feedback_hinders: string;
  important: string;
}

const defaultAnswers: Answers = {
  respondent_name: '',
  respondent_email: '',
  main_work: '',
  main_achievement: '',
  difficulties: [],
  work_conditions: {},
  learned: '',
  want_to_develop: '',
  wellbeing: '',
  feedback_helps: '',
  feedback_hinders: '',
  important: '',
};

export default function EmbedSurvey() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') || 'light';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ ...defaultAnswers });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [cycleData, setCycleData] = useState<any>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    loadCycle();
  }, [cycleId]);

  // Auto-resize iframe via postMessage
  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage({ type: 'mira-resize', height: document.body.scrollHeight + 40 }, '*');
    };
    sendHeight();
    const observer = new MutationObserver(sendHeight);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', sendHeight);
    return () => { observer.disconnect(); window.removeEventListener('resize', sendHeight); };
  }, []);

  async function loadCycle() {
    if (!cycleId) return;
    const { data } = await supabase
      .from('survey_cycles')
      .select('id, label, period_start, period_end, template_id, status, template:survey_templates!inner(name, type)')
      .eq('id', cycleId)
      .single();
    if (data) setCycleData(data);
    setLoading(false);
  }

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  function toggleDifficulty(d: string) {
    update('difficulties', answers.difficulties.includes(d)
      ? answers.difficulties.filter(x => x !== d)
      : [...answers.difficulties, d]);
  }

  async function handleSubmit() {
    if (!answers.main_work.trim()) {
      setError('Заполните поле «Над чем работали»');
      setStep(1);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('embed_responses' as any).insert({
        cycle_id: cycleId,
        template_id: cycleData?.template_id,
        answers_json: answers,
        respondent_email: answers.respondent_email || null,
        source: 'embed',
        metadata: { respondent_name: answers.respondent_name, theme, origin: document.referrer },
      });
      if (insertError) throw insertError;
      setSubmitted(true);
      window.parent.postMessage({ type: 'mira-submitted' }, '*');
    } catch (e: any) {
      setError(e.message || 'Ошибка при отправке');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!cycleData) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background text-foreground">
        <p className="text-muted-foreground">Опрос не найден или недоступен</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-background text-foreground p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
          <CheckCircle2 size={32} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold mb-2">Спасибо за участие</h2>
        <p className="text-muted-foreground">Ваш ответ принят. Мы ценим ваше мнение.</p>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const textareaCls = cn(inputCls, "resize-none");
  const labelCls = "block text-sm font-medium mb-1 text-foreground";
  const cardCls = "rounded-xl border border-border bg-card p-5 shadow-sm";

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base tracking-wide">МИРА</span>
            <span className="text-xs text-muted-foreground">• встроенный опрос</span>
          </div>
          <h1 className="text-lg font-bold">{(cycleData as any)?.template?.name || 'Опрос'}</h1>
          <p className="text-sm text-muted-foreground">{cycleData.label} • {cycleData.period_start} — {cycleData.period_end}</p>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        {/* Step 0: Info */}
        {step === 0 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Общая информация</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Ваше имя (необязательно)</label>
                <input className={inputCls} value={answers.respondent_name} onChange={e => update('respondent_name', e.target.value)} placeholder="Иван Петров" />
              </div>
              <div>
                <label className={labelCls}>Email (необязательно)</label>
                <input className={inputCls} type="email" value={answers.respondent_email} onChange={e => update('respondent_email', e.target.value)} placeholder="email@company.ru" />
              </div>
              <div>
                <label className={labelCls}>Период опроса</label>
                <input className={inputCls} value={`${cycleData.period_start} — ${cycleData.period_end}`} disabled />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Work */}
        {step === 1 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Работа за период</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Над чем главным вы работали? *</label>
                <textarea className={textareaCls} rows={4} value={answers.main_work} onChange={e => update('main_work', e.target.value.slice(0, 2000))} placeholder="Перечислите основные задачи/проекты..." />
                <p className="text-xs text-muted-foreground mt-1">{answers.main_work.length}/2000</p>
              </div>
              <div>
                <label className={labelCls}>Главное достижение</label>
                <textarea className={textareaCls} rows={3} value={answers.main_achievement} onChange={e => update('main_achievement', e.target.value.slice(0, 2000))} placeholder="Чем гордитесь?" />
              </div>
              <div>
                <label className={labelCls}>С какими сложностями столкнулись?</label>
                {DIFFICULTIES.map(d => (
                  <label key={d} className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input type="checkbox" checked={answers.difficulties.includes(d)} onChange={() => toggleDifficulty(d)} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">{d}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Work Conditions */}
        {step === 2 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Оценка условий работы</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 pr-4 font-medium">Параметр</th>
                    {LIKERT_OPTIONS.map(o => (
                      <th key={o} className="text-center py-2 px-1 font-medium text-xs">{o}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {WORK_CONDITIONS.map(cond => (
                    <tr key={cond} className="border-t border-border">
                      <td className="py-3 pr-4 text-sm">{cond}</td>
                      {LIKERT_OPTIONS.map(opt => (
                        <td key={opt} className="text-center py-3 px-1">
                          <input type="radio" name={`cond_${cond}`} checked={answers.work_conditions[cond] === opt}
                            onChange={() => update('work_conditions', { ...answers.work_conditions, [cond]: opt })}
                            className="w-4 h-4 accent-primary" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Step 3: Growth */}
        {step === 3 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Рост и развитие</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Чему вы научились за этот период?</label>
                <textarea className={textareaCls} rows={3} value={answers.learned} onChange={e => update('learned', e.target.value.slice(0, 2000))} />
              </div>
              <div>
                <label className={labelCls}>Что хотите развивать?</label>
                <textarea className={textareaCls} rows={3} value={answers.want_to_develop} onChange={e => update('want_to_develop', e.target.value.slice(0, 2000))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Wellbeing */}
        {step === 4 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Состояние и динамика</h2>
            <div>
              <label className={labelCls}>Как вы себя ощущаете?</label>
              {WELLBEING_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="radio" name="wellbeing" checked={answers.wellbeing === opt}
                    onChange={() => update('wellbeing', opt)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Feedback */}
        {step === 5 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Обратная связь</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Что помогает в работе?</label>
                <textarea className={textareaCls} rows={3} value={answers.feedback_helps} onChange={e => update('feedback_helps', e.target.value.slice(0, 2000))} />
              </div>
              <div>
                <label className={labelCls}>Что мешает?</label>
                <textarea className={textareaCls} rows={3} value={answers.feedback_hinders} onChange={e => update('feedback_hinders', e.target.value.slice(0, 2000))} />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Important */}
        {step === 6 && (
          <div className={cardCls}>
            <h2 className="font-semibold mb-4">Важное</h2>
            <div>
              <label className={labelCls}>Что ещё важно сказать?</label>
              <textarea className={textareaCls} rows={4} value={answers.important} onChange={e => update('important', e.target.value.slice(0, 2000))} placeholder="Всё, что считаете важным..." />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={16} /> Назад
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
            >
              Далее <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-60 transition-colors"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Отправить
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Опрос проводится на платформе МИРА
        </div>
      </div>
    </div>
  );
}
