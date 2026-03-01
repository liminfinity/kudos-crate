import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Loader2, Star, FolderOpen, Building2, TrendingUp, Heart, MessageCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SelectableCard } from '@/components/survey/SelectableCard';
import { EmojiScale } from '@/components/survey/EmojiScale';
import { LikertCards } from '@/components/survey/LikertCards';
import { SurveyCompletion } from '@/components/survey/SurveyCompletion';
import { SurveyProgress } from '@/components/survey/SurveyProgress';
import { StepWrapper } from '@/components/survey/StepWrapper';
import { MiraHint } from '@/components/MiraHint';

const STEPS = ['Привет', 'Работа', 'Условия', 'Развитие', 'Состояние', 'Обратная связь', 'Важное'];
const STEP_ICONS = [Star, FolderOpen, Building2, TrendingUp, Heart, MessageCircle, AlertTriangle];

const DIFFICULTIES = [
  { label: 'Размытые цели', emoji: '🎯' },
  { label: 'Перегрузка', emoji: '⚡' },
  { label: 'Зависимости от других', emoji: '🔗' },
  { label: 'Нехватка опыта', emoji: '📚' },
  { label: 'Коммуникация', emoji: '💬' },
];

const WORK_CONDITIONS = [
  'Понимаю ожидания',
  'Хватает ресурсов',
  'Задачи понятны',
  'Поддержка руководителя',
  'Атмосфера в команде',
  'Нагрузка справедлива',
];

const LIKERT_OPTIONS = [
  { label: 'Полностью устраивает', emoji: '😊' },
  { label: 'Скорее да', emoji: '🙂' },
  { label: 'Скорее нет', emoji: '😐' },
  { label: 'Не устраивает', emoji: '😟' },
];

const WELLBEING_EMOJI = [
  { emoji: '😟', label: 'Тяжело', value: 'Близок к выгоранию' },
  { emoji: '😐', label: 'Напряжение', value: 'Часто чувствую напряжение или усталость' },
  { emoji: '🙂', label: 'Нормально', value: 'Рабочее состояние, но бывают сложности' },
  { emoji: '😊', label: 'Комфортно', value: 'Стабильно, комфортно' },
  { emoji: '🔥', label: 'Отлично', value: 'Энергия и драйв' },
];

const STEP_MIRA_HINTS: Record<number, string> = {
  0: 'Это займёт всего 3–5 минут. Отвечайте как чувствуете.',
  2: 'Честная оценка помогает улучшить рабочую среду для всех.',
  4: 'Ваше состояние важно. Выберите то, что ближе.',
};

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
      const { error: insertError } = await supabase.from('embed_responses').insert([{
        cycle_id: cycleId!,
        template_id: cycleData?.template_id,
        answers_json: answers as any,
        respondent_email: answers.respondent_email || null,
        source: 'embed',
        metadata: { respondent_name: answers.respondent_name, theme, origin: document.referrer } as any,
      }]);
      if (insertError) throw insertError;
      setSubmitted(true);
      window.parent.postMessage({ type: 'mira-submitted' }, '*');
    } catch (e: any) {
      setError(e.message || 'Ошибка при отправке');
    }
    setSubmitting(false);
  }

  const inputCls = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all";
  const textareaCls = cn(inputCls, "resize-none");
  const labelCls = "block text-sm font-medium mb-1.5 text-foreground";

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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <SurveyCompletion
          title="Спасибо за участие!"
          subtitle="Ваш ответ принят. Мы ценим ваше мнение и используем его для улучшений."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base tracking-wide">МИРА</span>
            <span className="text-xs text-muted-foreground">• опрос</span>
          </div>
          <h1 className="text-lg font-bold">{(cycleData as any)?.template?.name || 'Опрос'}</h1>
          <p className="text-sm text-muted-foreground">{cycleData.label} • {cycleData.period_start} — {cycleData.period_end}</p>
        </div>

        {/* Progress */}
        <SurveyProgress
          currentStep={step}
          totalSteps={STEPS.length}
          stepNames={STEPS}
          stepIcons={STEP_ICONS}
          onStepClick={setStep}
          compact
        />

        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}

        {/* Mira hint */}
        {STEP_MIRA_HINTS[step] && (
          <MiraHint variant="tip" className="mb-4">
            {STEP_MIRA_HINTS[step]}
          </MiraHint>
        )}

        {/* Step 0: Hello */}
        {step === 0 && (
          <StepWrapper icon={Star} title="Привет 👋">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Ваше имя <span className="text-muted-foreground font-normal">(необязательно)</span></label>
                <input className={inputCls} value={answers.respondent_name} onChange={e => update('respondent_name', e.target.value)} placeholder="Иван" />
              </div>
              <div>
                <label className={labelCls}>Email <span className="text-muted-foreground font-normal">(необязательно)</span></label>
                <input className={inputCls} type="email" value={answers.respondent_email} onChange={e => update('respondent_email', e.target.value)} placeholder="email@company.ru" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 1: Work */}
        {step === 1 && (
          <StepWrapper icon={FolderOpen} title="Работа за период">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Над чем работали? *</label>
                <textarea className={textareaCls} rows={3} value={answers.main_work} onChange={e => update('main_work', e.target.value.slice(0, 2000))} placeholder="Основные задачи и проекты" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{answers.main_work.length}/2000</p>
              </div>
              <div>
                <label className={labelCls}>Главное достижение 🏆</label>
                <textarea className={textareaCls} rows={2} value={answers.main_achievement} onChange={e => update('main_achievement', e.target.value.slice(0, 2000))} placeholder="Чем гордитесь?" />
              </div>
              <div>
                <label className={labelCls}>Сложности</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIFFICULTIES.map(d => (
                    <SelectableCard
                      key={d.label}
                      selected={answers.difficulties.includes(d.label)}
                      onClick={() => toggleDifficulty(d.label)}
                      emoji={d.emoji}
                      label={d.label}
                      className="p-3"
                    />
                  ))}
                </div>
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 2: Work Conditions */}
        {step === 2 && (
          <StepWrapper icon={Building2} title="Условия работы">
            <div className="space-y-3">
              {WORK_CONDITIONS.map(cond => (
                <LikertCards
                  key={cond}
                  question={cond}
                  options={LIKERT_OPTIONS}
                  value={answers.work_conditions[cond] || ''}
                  onChange={(val) => update('work_conditions', { ...answers.work_conditions, [cond]: val })}
                />
              ))}
            </div>
          </StepWrapper>
        )}

        {/* Step 3: Growth */}
        {step === 3 && (
          <StepWrapper icon={TrendingUp} title="Развитие">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Чему научились? 📖</label>
                <textarea className={textareaCls} rows={2} value={answers.learned} onChange={e => update('learned', e.target.value.slice(0, 2000))} placeholder="Новые навыки, знания, опыт" />
              </div>
              <div>
                <label className={labelCls}>Что хотите развивать? 🚀</label>
                <textarea className={textareaCls} rows={2} value={answers.want_to_develop} onChange={e => update('want_to_develop', e.target.value.slice(0, 2000))} placeholder="Куда хотите расти?" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 4: Wellbeing — Emoji Scale */}
        {step === 4 && (
          <StepWrapper icon={Heart} title="Как вы себя чувствуете?">
            <div className="py-4">
              <EmojiScale
                options={WELLBEING_EMOJI}
                value={answers.wellbeing}
                onChange={(val) => update('wellbeing', val)}
              />
            </div>
          </StepWrapper>
        )}

        {/* Step 5: Feedback */}
        {step === 5 && (
          <StepWrapper icon={MessageCircle} title="Обратная связь">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Что помогает? 💪</label>
                <textarea className={textareaCls} rows={2} value={answers.feedback_helps} onChange={e => update('feedback_helps', e.target.value.slice(0, 2000))} placeholder="Напишите главное" />
              </div>
              <div>
                <label className={labelCls}>Что мешает? 🚧</label>
                <textarea className={textareaCls} rows={2} value={answers.feedback_hinders} onChange={e => update('feedback_hinders', e.target.value.slice(0, 2000))} placeholder="Напишите главное" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 6: Important */}
        {step === 6 && (
          <StepWrapper icon={AlertTriangle} title="Важное">
            <div>
              <label className={labelCls}>Что ещё хотите сказать?</label>
              <textarea className={textareaCls} rows={3} value={answers.important} onChange={e => update('important', e.target.value.slice(0, 2000))} placeholder="Всё, что считаете важным" />
            </div>
          </StepWrapper>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <button
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 transition-all"
          >
            <ChevronLeft size={16} /> Назад
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-1 px-5 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all active:scale-[0.97]"
            >
              Далее <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-60 transition-all active:scale-[0.97]"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : '✨'}
              Отправить
            </button>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Опрос проводится на платформе МИРА
        </div>
      </div>
    </div>
  );
}
