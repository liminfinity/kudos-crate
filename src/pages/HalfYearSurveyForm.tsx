import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, ChevronLeft, ChevronRight, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';
import { useTextProcessor } from '@/hooks/useTextProcessor';
import { MiraHint } from '@/components/MiraHint';
import { STEP_ICONS } from '@/components/SurveyStepIcons';

function StepIcon({ step, size = 18 }: { step: number; size?: number }) {
  const Icon = STEP_ICONS[step];
  return Icon ? <Icon size={size} /> : null;
}

const STEPS = [
  'Общая информация',
  'Работа за период',
  'Условия работы',
  'Рост и развитие',
  'Социометрия',
  'Состояние',
  'Роль в команде',
  'Обратная связь',
  'Планы',
  'Важное',
];

const STEP_HINTS: Record<number, string> = {
  1: 'Постарайтесь вспомнить ключевые проекты и задачи. Конкретные примеры помогут руководителю лучше понять ваш вклад.',
  2: 'Оцените условия честно — это анонимный срез, и он помогает улучшить рабочую среду.',
  4: 'Укажите тех, с кем реально взаимодействовали. Это поможет увидеть реальную структуру команды.',
  5: 'Честная самооценка состояния помогает вовремя заметить проблемы и получить поддержку.',
};

const DIFFICULTIES = [
  'Размытые требования/цели',
  'Высокая нагрузка/переработки',
  'Зависимости от других (ждем ответов)',
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

const LIKERT_OPTIONS = [
  { label: 'Полностью устраивает', emoji: '😊' },
  { label: 'Скорее да', emoji: '🙂' },
  { label: 'Скорее нет', emoji: '😐' },
  { label: 'Не устраивает', emoji: '😟' },
];

const WELLBEING_OPTIONS = [
  { label: 'Стабильно, комфортно, чувствую опору', emoji: '💚', color: 'bg-positive/10 border-positive/30 hover:bg-positive/20' },
  { label: 'Рабочее состояние, но бывают сложности', emoji: '💛', color: 'bg-chart-4/10 border-chart-4/30 hover:bg-chart-4/20' },
  { label: 'Часто чувствую напряжение или усталость', emoji: '🧡', color: 'bg-chart-4/10 border-chart-4/30 hover:bg-chart-4/20' },
  { label: 'Близок к выгоранию / Мне тяжело', emoji: '❤️', color: 'bg-negative/10 border-negative/30 hover:bg-negative/20' },
];

const INVOLVEMENT_OPTIONS = [
  { label: 'Был(а) драйвером, много инициатив', emoji: '🚀' },
  { label: 'Работал(а) в штатном режиме', emoji: '⚙️' },
  { label: 'Был(а) пассивен / делал(а) только то, что просили', emoji: '🐢' },
  { label: 'Было сложно включиться в задачи', emoji: '😔' },
];

const TEAM_ROLES = [
  { label: 'Идейный вдохновитель', desc: 'генератор идей', emoji: '💡' },
  { label: 'Исполнитель', desc: 'довожу задачи до конца', emoji: '✅' },
  { label: 'Координатор', desc: 'организую людей и процессы', emoji: '🗂️' },
  { label: 'Эксперт/аналитик', desc: 'люблю разбираться в деталях', emoji: '🔬' },
  { label: 'Коммуникатор', desc: 'поддерживаю связь, помогаю другим', emoji: '🤝' },
  { label: 'Критик', desc: 'замечаю риски и ошибки', emoji: '🛡️' },
];

interface Answers {
  fill_date: string;
  main_work: string;
  main_achievement: string;
  difficulties: string[];
  difficulties_other: string;
  work_conditions: Record<string, string>;
  learned: string;
  want_to_develop: string;
  sociometry_interact: string[];
  sociometry_help: string;
  sociometry_comfortable: string;
  sociometry_project: string;
  wellbeing: string;
  involvement: string;
  team_roles: string[];
  feedback_helps: string;
  feedback_hinders: string;
  plans: string;
  important: string;
}

const defaultAnswers: Answers = {
  fill_date: new Date().toISOString().split('T')[0],
  main_work: '',
  main_achievement: '',
  difficulties: [],
  difficulties_other: '',
  work_conditions: {},
  learned: '',
  want_to_develop: '',
  sociometry_interact: [],
  sociometry_help: '',
  sociometry_comfortable: '',
  sociometry_project: '',
  wellbeing: '',
  involvement: '',
  team_roles: [],
  feedback_helps: '',
  feedback_hinders: '',
  plans: '',
  important: '',
};

export default function HalfYearSurveyForm() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({ ...defaultAnswers });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState('');
  const { processText, processing } = useTextProcessor();

  const [socSearch, setSocSearch] = useState('');
  const [socDropdownOpen, setSocDropdownOpen] = useState(false);

  useEffect(() => { loadData(); }, [assignmentId]);

  async function loadData() {
    const [aRes, profRes] = await Promise.all([
      supabase.from('survey_assignments').select(`
        id, cycle_id, user_id, status, team_id,
        cycle:survey_cycles!inner(label, period_start, period_end, due_date,
          template:survey_templates!inner(name, type))
      `).eq('id', assignmentId!).single(),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ]);

    if (aRes.data) {
      setAssignmentData(aRes.data);
      if ((aRes.data as any).status === 'submitted') setReadOnly(true);
      const { data: resp } = await supabase
        .from('survey_responses')
        .select('answers_json')
        .eq('assignment_id', assignmentId!)
        .maybeSingle();
      if (resp?.answers_json) {
        setAnswers({ ...defaultAnswers, ...(resp.answers_json as any) });
      }
    }
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    setLoading(false);
  }

  const otherUsers = useMemo(() => profiles.filter(p => p.id !== user?.id), [profiles, user]);
  const filteredSocUsers = useMemo(() =>
    otherUsers.filter(p =>
      p.full_name.toLowerCase().includes(socSearch.toLowerCase()) &&
      !answers.sociometry_interact.includes(p.id)
    ), [otherUsers, socSearch, answers.sociometry_interact]);

  function update<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  function toggleDifficulty(d: string) {
    update('difficulties', answers.difficulties.includes(d)
      ? answers.difficulties.filter(x => x !== d)
      : [...answers.difficulties, d]);
  }

  function toggleTeamRole(r: string) {
    const cur = answers.team_roles;
    if (cur.includes(r)) update('team_roles', cur.filter(x => x !== r));
    else if (cur.length < 2) update('team_roles', [...cur, r]);
  }

  function addSocUser(userId: string) {
    if (answers.sociometry_interact.length >= 5) return;
    update('sociometry_interact', [...answers.sociometry_interact, userId]);
    setSocSearch('');
    setSocDropdownOpen(false);
  }

  function removeSocUser(userId: string) {
    update('sociometry_interact', answers.sociometry_interact.filter(id => id !== userId));
  }

  async function handleSaveDraft() {
    if (!assignmentId || readOnly) return;
    setSubmitting(true);
    try {
      await supabase.from('survey_assignments').update({
        status: 'in_progress' as any,
        started_at: new Date().toISOString(),
      }).eq('id', assignmentId);

      const { data: existing } = await supabase.from('survey_responses')
        .select('id').eq('assignment_id', assignmentId).maybeSingle();

      if (existing) {
        await supabase.from('survey_responses').update({ answers_json: answers as any }).eq('id', existing.id);
      } else {
        await supabase.from('survey_responses').insert({ assignment_id: assignmentId, answers_json: answers as any });
      }
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!assignmentId || readOnly) return;
    if (answers.sociometry_interact.length < 2 || answers.sociometry_interact.length > 5) {
      setError('Укажите от 2 до 5 коллег в разделе Социометрия');
      setStep(4);
      return;
    }
    if (!answers.main_work.trim()) {
      setError('Заполните поле "Над чем работали" в разделе Работа');
      setStep(1);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const textFields: (keyof Answers)[] = ['main_work', 'main_achievement', 'learned', 'want_to_develop', 'feedback_helps', 'feedback_hinders', 'plans', 'important'];
      const processedAnswers = { ...answers };
      for (const field of textFields) {
        const val = processedAnswers[field];
        if (typeof val === 'string' && val.trim().length > 3) {
          const result = await processText(val, 'survey');
          if (result?.status === 'INVALID') {
            setError(`Текст в поле "${field}" не прошёл проверку. Уточните формулировку.`);
            setSubmitting(false);
            return;
          }
          if (result?.processed_text) (processedAnswers as any)[field] = result.processed_text;
        }
      }
      setAnswers(processedAnswers);

      const { data: existing } = await supabase.from('survey_responses')
        .select('id').eq('assignment_id', assignmentId).maybeSingle();
      if (existing) {
        await supabase.from('survey_responses').update({ answers_json: processedAnswers as any }).eq('id', existing.id);
      } else {
        await supabase.from('survey_responses').insert({ assignment_id: assignmentId, answers_json: processedAnswers as any });
      }

      await supabase.from('survey_assignments').update({
        status: 'submitted' as any,
        submitted_at: new Date().toISOString(),
      }).eq('id', assignmentId);

      setSubmitted(true);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  if (loading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;
  }

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
            <CheckCircle2 size={32} className="text-positive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Опрос отправлен!</h2>
          <p className="text-muted-foreground mb-6">Спасибо за заполнение полугодового среза.</p>
          <Button onClick={() => navigate('/surveys')}>К списку опросов</Button>
        </div>
      </AppLayout>
    );
  }

  const cycleLabel = (assignmentData as any)?.cycle?.label || '';
  const periodStr = `${(assignmentData as any)?.cycle?.period_start} — ${(assignmentData as any)?.cycle?.period_end}`;
  const progressPercent = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold">Полугодовой срез</h1>
            <p className="text-sm text-muted-foreground">{cycleLabel} • {periodStr}</p>
          </div>
          {readOnly && <Badge variant="secondary">Только просмотр</Badge>}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Шаг {step + 1} из {STEPS.length}</span>
            <span className="text-xs font-medium text-primary">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Step tabs with icons */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                  i === step
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : i < step
                    ? "bg-positive/10 text-positive hover:bg-positive/20"
                    : "bg-muted text-muted-foreground hover:bg-accent/10"
                )}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{s}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {/* Mira contextual hint */}
        {STEP_HINTS[step] && (
          <MiraHint variant="tip" className="mb-4">
            {STEP_HINTS[step]}
          </MiraHint>
        )}

        {/* Step 0: General Info */}
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={0} /> Общая информация</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>ФИО</Label><Input value={profile?.full_name || ''} disabled /></div>
              <div><Label>Период среза</Label><Input value={periodStr} disabled /></div>
              <div><Label>Дата заполнения</Label><Input type="date" value={answers.fill_date} onChange={e => update('fill_date', e.target.value)} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Work */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={1} /> Работа за период</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Над чем главным вы работали? *</Label>
                <Textarea value={answers.main_work} onChange={e => update('main_work', e.target.value.slice(0, 2000))} rows={4} disabled={readOnly} placeholder="Перечислите основные задачи/проекты..." />
                <p className="text-xs text-muted-foreground mt-1">{answers.main_work.length}/2000</p>
              </div>
              <div>
                <Label>Главное достижение</Label>
                <Textarea value={answers.main_achievement} onChange={e => update('main_achievement', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} placeholder="Чем гордитесь?" />
              </div>
              <div>
                <Label className="mb-2 block">С какими сложностями столкнулись?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIFFICULTIES.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => !readOnly && toggleDifficulty(d)}
                      disabled={readOnly}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border text-sm text-left transition-all",
                        answers.difficulties.includes(d)
                          ? "bg-primary/10 border-primary/30 text-foreground"
                          : "bg-card border-border hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <Checkbox checked={answers.difficulties.includes(d)} className="pointer-events-none" />
                      <span>{d}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <Input value={answers.difficulties_other} onChange={e => update('difficulties_other', e.target.value)} disabled={readOnly} placeholder="Другое..." />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Work Conditions — Card-based Likert */}
        {step === 2 && (
          <div className="space-y-3">
            {WORK_CONDITIONS.map(cond => (
              <Card key={cond} className="overflow-hidden">
                <CardContent className="pt-4 pb-3">
                  <p className="text-sm font-medium mb-3">{cond}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {LIKERT_OPTIONS.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => !readOnly && update('work_conditions', { ...answers.work_conditions, [cond]: opt.label })}
                        disabled={readOnly}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-all",
                          answers.work_conditions[cond] === opt.label
                            ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                            : "bg-card border-border hover:bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-center leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 3: Growth */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={3} /> Рост и развитие</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Чему научились за эти полгода?</Label>
                <Textarea value={answers.learned} onChange={e => update('learned', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} />
              </div>
              <div>
                <Label>Что хотите развивать дальше?</Label>
                <Textarea value={answers.want_to_develop} onChange={e => update('want_to_develop', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} placeholder="Какая поддержка нужна?" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Sociometry */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={4} /> Социометрия</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>С кем взаимодействовали чаще всего? (2–5 человек) *</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {answers.sociometry_interact.map(uid => {
                    const p = profiles.find(pr => pr.id === uid);
                    return (
                      <Badge key={uid} variant="secondary" className="gap-1 py-1.5 px-3">
                        {p?.full_name || uid}
                        {!readOnly && <X size={12} className="cursor-pointer" onClick={() => removeSocUser(uid)} />}
                      </Badge>
                    );
                  })}
                </div>
                {!readOnly && answers.sociometry_interact.length < 5 && (
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={socSearch} onChange={e => { setSocSearch(e.target.value); setSocDropdownOpen(true); }} onFocus={() => setSocDropdownOpen(true)} onBlur={() => setTimeout(() => setSocDropdownOpen(false), 200)} placeholder="Поиск сотрудника..." className="pl-9" />
                    {socDropdownOpen && socSearch && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredSocUsers.length > 0 ? filteredSocUsers.map(u => (
                          <button key={u.id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent" onMouseDown={e => e.preventDefault()} onClick={() => addSocUser(u.id)}>{u.full_name}</button>
                        )) : <p className="p-3 text-sm text-muted-foreground">Не найдено</p>}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Выбрано: {answers.sociometry_interact.length}/5</p>
              </div>
              <div><Label>К кому обращались за помощью?</Label><Textarea value={answers.sociometry_help} onChange={e => update('sociometry_help', e.target.value.slice(0, 500))} rows={2} disabled={readOnly} /></div>
              <div><Label>С кем было комфортно и продуктивно работать?</Label><Textarea value={answers.sociometry_comfortable} onChange={e => update('sociometry_comfortable', e.target.value.slice(0, 500))} rows={2} disabled={readOnly} /></div>
              <div><Label>Кого бы взяли в команду на сложный проект? (опционально)</Label><Textarea value={answers.sociometry_project} onChange={e => update('sociometry_project', e.target.value.slice(0, 500))} rows={2} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Wellbeing — Selectable Cards */}
        {step === 5 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={5} /> Состояние и динамика</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Как вы себя чувствовали в команде?</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WELLBEING_OPTIONS.map(o => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => !readOnly && update('wellbeing', o.label)}
                      disabled={readOnly}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border text-sm text-left transition-all",
                        answers.wellbeing === o.label
                          ? cn(o.color, "ring-2 ring-primary/20")
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="text-2xl">{o.emoji}</span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-3 block">Ваша вовлеченность за полугодие:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INVOLVEMENT_OPTIONS.map(o => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => !readOnly && update('involvement', o.label)}
                      disabled={readOnly}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-lg border text-sm text-left transition-all",
                        answers.involvement === o.label
                          ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                          : "bg-card border-border hover:bg-muted/50"
                      )}
                    >
                      <span className="text-2xl">{o.emoji}</span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Team Role — Selectable Cards */}
        {step === 6 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={6} /> Роль в команде</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Выберите 1–2 варианта</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TEAM_ROLES.map(r => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => !readOnly && toggleTeamRole(r.label)}
                    disabled={readOnly || (answers.team_roles.length >= 2 && !answers.team_roles.includes(r.label))}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border text-left transition-all",
                      answers.team_roles.includes(r.label)
                        ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20"
                        : "bg-card border-border hover:bg-muted/50",
                      answers.team_roles.length >= 2 && !answers.team_roles.includes(r.label) && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <span className="text-2xl">{r.emoji}</span>
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 7: Feedback */}
        {step === 7 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={7} /> Обратная связь</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Что в работе команды/руководителя вам особенно помогает?</Label><Textarea value={answers.feedback_helps} onChange={e => update('feedback_helps', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label>Что мешает работать эффективно?</Label><Textarea value={answers.feedback_hinders} onChange={e => update('feedback_hinders', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {/* Step 8: Plans */}
        {step === 8 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={8} /> Планы</CardTitle></CardHeader>
            <CardContent>
              <Label>Какие цели ставите себе?</Label>
              <Textarea value={answers.plans} onChange={e => update('plans', e.target.value.slice(0, 2000))} rows={4} disabled={readOnly} placeholder="Что конкретно хотите сделать / изменить / получить?" />
            </CardContent>
          </Card>
        )}

        {/* Step 9: Important */}
        {step === 9 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><StepIcon step={9} /> Важное</CardTitle></CardHeader>
            <CardContent>
              <Label>Что ещё не спросили, но вы хотите сказать?</Label>
              <Textarea value={answers.important} onChange={e => update('important', e.target.value.slice(0, 2000))} rows={4} disabled={readOnly} />
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft size={16} className="mr-1" /> Назад
          </Button>
          <span className="text-sm text-muted-foreground">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Далее <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <div className="flex gap-2">
              {!readOnly && (
                <>
                  <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>Сохранить черновик</Button>
                  <Button onClick={handleSubmit} disabled={submitting}>{submitting ? 'Отправка...' : 'Отправить'}</Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
