import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';
import { useTextProcessor } from '@/hooks/useTextProcessor';
import { MiraHint } from '@/components/MiraHint';
import { STEP_ICONS } from '@/components/SurveyStepIcons';
import { SelectableCard } from '@/components/survey/SelectableCard';
import { EmojiScale } from '@/components/survey/EmojiScale';
import { LikertCards } from '@/components/survey/LikertCards';
import { SurveyCompletion } from '@/components/survey/SurveyCompletion';
import { SurveyProgress } from '@/components/survey/SurveyProgress';
import { StepWrapper } from '@/components/survey/StepWrapper';

const STEPS = [
  'Привет', 'Работа', 'Условия', 'Развитие', 'Социометрия',
  'Состояние', 'Роль', 'Обратная связь', 'Планы', 'Важное',
];

const STEP_HINTS: Record<number, string> = {
  0: 'Это займёт 5–7 минут. Отвечайте как чувствуете — нет правильных ответов.',
  1: 'Вспомните ключевые проекты. Конкретные примеры помогут руководителю оценить ваш вклад.',
  2: 'Честная оценка помогает улучшить рабочую среду для всех.',
  4: 'Укажите тех, с кем реально взаимодействовали — это покажет реальную структуру.',
  5: 'Ваше состояние важно. Выберите то, что ближе всего.',
  6: 'Выберите 1–2 роли, которые вам ближе всего.',
};

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
  { emoji: '😟', label: 'Тяжело', value: 'Близок к выгоранию / Мне тяжело' },
  { emoji: '😐', label: 'Напряжение', value: 'Часто чувствую напряжение или усталость' },
  { emoji: '🙂', label: 'Нормально', value: 'Рабочее состояние, но бывают сложности' },
  { emoji: '😊', label: 'Комфортно', value: 'Стабильно, комфортно, чувствую опору' },
  { emoji: '🔥', label: 'Отлично', value: 'Энергия и драйв' },
];

const INVOLVEMENT_OPTIONS = [
  { label: 'Драйвер', emoji: '🚀', desc: 'Много инициатив' },
  { label: 'Штатный режим', emoji: '⚙️', desc: 'Стабильная работа' },
  { label: 'Пассивный', emoji: '🐢', desc: 'Делал(а) что просили' },
  { label: 'Сложно включиться', emoji: '😔', desc: 'Были барьеры' },
];

const TEAM_ROLES = [
  { label: 'Идейный вдохновитель', desc: 'Генератор идей', emoji: '💡' },
  { label: 'Исполнитель', desc: 'Довожу до конца', emoji: '✅' },
  { label: 'Координатор', desc: 'Организую процессы', emoji: '🗂️' },
  { label: 'Эксперт', desc: 'Разбираюсь в деталях', emoji: '🔬' },
  { label: 'Коммуникатор', desc: 'Поддерживаю связь', emoji: '🤝' },
  { label: 'Критик', desc: 'Замечаю риски', emoji: '🛡️' },
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
  main_work: '', main_achievement: '',
  difficulties: [], difficulties_other: '',
  work_conditions: {},
  learned: '', want_to_develop: '',
  sociometry_interact: [], sociometry_help: '', sociometry_comfortable: '', sociometry_project: '',
  wellbeing: '', involvement: '', team_roles: [],
  feedback_helps: '', feedback_hinders: '',
  plans: '', important: '',
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
  const { processText } = useTextProcessor();
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
      const { data: resp } = await supabase.from('survey_responses')
        .select('answers_json').eq('assignment_id', assignmentId!).maybeSingle();
      if (resp?.answers_json) setAnswers({ ...defaultAnswers, ...(resp.answers_json as any) });
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
    update('difficulties', answers.difficulties.includes(d) ? answers.difficulties.filter(x => x !== d) : [...answers.difficulties, d]);
  }
  function toggleTeamRole(r: string) {
    const cur = answers.team_roles;
    if (cur.includes(r)) update('team_roles', cur.filter(x => x !== r));
    else if (cur.length < 2) update('team_roles', [...cur, r]);
  }
  function addSocUser(userId: string) {
    if (answers.sociometry_interact.length >= 5) return;
    update('sociometry_interact', [...answers.sociometry_interact, userId]);
    setSocSearch(''); setSocDropdownOpen(false);
  }
  function removeSocUser(userId: string) {
    update('sociometry_interact', answers.sociometry_interact.filter(id => id !== userId));
  }

  async function handleSaveDraft() {
    if (!assignmentId || readOnly) return;
    setSubmitting(true);
    try {
      await supabase.from('survey_assignments').update({ status: 'in_progress' as any, started_at: new Date().toISOString() }).eq('id', assignmentId);
      const { data: existing } = await supabase.from('survey_responses').select('id').eq('assignment_id', assignmentId).maybeSingle();
      if (existing) await supabase.from('survey_responses').update({ answers_json: answers as any }).eq('id', existing.id);
      else await supabase.from('survey_responses').insert({ assignment_id: assignmentId, answers_json: answers as any });
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!assignmentId || readOnly) return;
    if (answers.sociometry_interact.length < 2 || answers.sociometry_interact.length > 5) {
      setError('Укажите от 2 до 5 коллег в разделе Социометрия'); setStep(4); return;
    }
    if (!answers.main_work.trim()) {
      setError('Заполните поле «Над чем работали»'); setStep(1); return;
    }
    setSubmitting(true); setError('');
    try {
      const textFields: (keyof Answers)[] = ['main_work', 'main_achievement', 'learned', 'want_to_develop', 'feedback_helps', 'feedback_hinders', 'plans', 'important'];
      const processedAnswers = { ...answers };
      for (const field of textFields) {
        const val = processedAnswers[field];
        if (typeof val === 'string' && val.trim().length > 3) {
          const result = await processText(val, 'survey');
          if (result?.status === 'INVALID') { setError(`Текст в поле "${field}" не прошёл проверку.`); setSubmitting(false); return; }
          if (result?.processed_text) (processedAnswers as any)[field] = result.processed_text;
        }
      }
      setAnswers(processedAnswers);
      const { data: existing } = await supabase.from('survey_responses').select('id').eq('assignment_id', assignmentId).maybeSingle();
      if (existing) await supabase.from('survey_responses').update({ answers_json: processedAnswers as any }).eq('id', existing.id);
      else await supabase.from('survey_responses').insert({ assignment_id: assignmentId, answers_json: processedAnswers as any });
      await supabase.from('survey_assignments').update({ status: 'submitted' as any, submitted_at: new Date().toISOString() }).eq('id', assignmentId);
      setSubmitted(true);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  if (loading) return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-12">
          <SurveyCompletion
            title="Опрос отправлен!"
            subtitle="Спасибо за заполнение полугодового среза. Ваши ответы помогут улучшить работу команды."
            onAction={() => navigate('/surveys')}
            actionLabel="К списку опросов"
          />
        </div>
      </AppLayout>
    );
  }

  const cycleLabel = (assignmentData as any)?.cycle?.label || '';
  const periodStr = `${(assignmentData as any)?.cycle?.period_start} — ${(assignmentData as any)?.cycle?.period_end}`;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold">Полугодовой срез</h1>
            <p className="text-sm text-muted-foreground">{cycleLabel} • {periodStr}</p>
          </div>
          {readOnly && <Badge variant="secondary">Только просмотр</Badge>}
        </div>

        {/* Progress */}
        <SurveyProgress
          currentStep={step}
          totalSteps={STEPS.length}
          stepNames={STEPS}
          stepIcons={STEP_ICONS}
          onStepClick={setStep}
        />

        {error && <div className="mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">{error}</div>}

        {STEP_HINTS[step] && <MiraHint variant="tip" className="mb-4">{STEP_HINTS[step]}</MiraHint>}

        {/* Step 0: Info */}
        {step === 0 && (
          <StepWrapper icon={STEP_ICONS[0]} title="Привет 👋">
            <div className="space-y-4">
              <div><Label>ФИО</Label><Input value={profile?.full_name || ''} disabled /></div>
              <div><Label>Период</Label><Input value={periodStr} disabled /></div>
              <div><Label>Дата заполнения</Label><Input type="date" value={answers.fill_date} onChange={e => update('fill_date', e.target.value)} disabled={readOnly} /></div>
            </div>
          </StepWrapper>
        )}

        {/* Step 1: Work */}
        {step === 1 && (
          <StepWrapper icon={STEP_ICONS[1]} title="Работа за период">
            <div className="space-y-4">
              <div>
                <Label>Над чем работали? *</Label>
                <Textarea value={answers.main_work} onChange={e => update('main_work', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} placeholder="Основные задачи и проекты" />
                <p className="text-xs text-muted-foreground mt-1 text-right">{answers.main_work.length}/2000</p>
              </div>
              <div>
                <Label>Главное достижение 🏆</Label>
                <Textarea value={answers.main_achievement} onChange={e => update('main_achievement', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} placeholder="Чем гордитесь?" />
              </div>
              <div>
                <Label className="mb-2 block">Сложности</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DIFFICULTIES.map(d => (
                    <SelectableCard
                      key={d.label}
                      selected={answers.difficulties.includes(d.label)}
                      onClick={() => !readOnly && toggleDifficulty(d.label)}
                      disabled={readOnly}
                      emoji={d.emoji}
                      label={d.label}
                      className="p-3"
                    />
                  ))}
                </div>
                <Input value={answers.difficulties_other} onChange={e => update('difficulties_other', e.target.value)} disabled={readOnly} placeholder="Другое..." className="mt-2" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 2: Work Conditions */}
        {step === 2 && (
          <StepWrapper icon={STEP_ICONS[2]} title="Условия работы">
            <div className="space-y-3">
              {WORK_CONDITIONS.map(cond => (
                <LikertCards
                  key={cond}
                  question={cond}
                  options={LIKERT_OPTIONS}
                  value={answers.work_conditions[cond] || ''}
                  onChange={(val) => !readOnly && update('work_conditions', { ...answers.work_conditions, [cond]: val })}
                  disabled={readOnly}
                />
              ))}
            </div>
          </StepWrapper>
        )}

        {/* Step 3: Growth */}
        {step === 3 && (
          <StepWrapper icon={STEP_ICONS[3]} title="Развитие">
            <div className="space-y-4">
              <div>
                <Label>Чему научились? 📖</Label>
                <Textarea value={answers.learned} onChange={e => update('learned', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} placeholder="Новые навыки и знания" />
              </div>
              <div>
                <Label>Что хотите развивать? 🚀</Label>
                <Textarea value={answers.want_to_develop} onChange={e => update('want_to_develop', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} placeholder="Какая поддержка нужна?" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 4: Sociometry */}
        {step === 4 && (
          <StepWrapper icon={STEP_ICONS[4]} title="Социометрия">
            <div className="space-y-4">
              <div>
                <Label>С кем взаимодействовали чаще? (2–5) *</Label>
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
                    <Input value={socSearch} onChange={e => { setSocSearch(e.target.value); setSocDropdownOpen(true); }} onFocus={() => setSocDropdownOpen(true)} onBlur={() => setTimeout(() => setSocDropdownOpen(false), 200)} placeholder="Поиск..." className="pl-9" />
                    {socDropdownOpen && socSearch && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg max-h-40 overflow-y-auto">
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
              <div><Label>С кем было комфортно работать?</Label><Textarea value={answers.sociometry_comfortable} onChange={e => update('sociometry_comfortable', e.target.value.slice(0, 500))} rows={2} disabled={readOnly} /></div>
              <div><Label>Кого бы взяли в сложный проект?</Label><Textarea value={answers.sociometry_project} onChange={e => update('sociometry_project', e.target.value.slice(0, 500))} rows={2} disabled={readOnly} /></div>
            </div>
          </StepWrapper>
        )}

        {/* Step 5: Wellbeing — Emoji Scale + Involvement Cards */}
        {step === 5 && (
          <StepWrapper icon={STEP_ICONS[5]} title="Состояние">
            <div className="space-y-6">
              <div>
                <Label className="mb-4 block">Как вы себя чувствовали?</Label>
                <EmojiScale options={WELLBEING_EMOJI} value={answers.wellbeing} onChange={val => !readOnly && update('wellbeing', val)} disabled={readOnly} />
              </div>
              <div>
                <Label className="mb-3 block">Вовлечённость</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {INVOLVEMENT_OPTIONS.map(o => (
                    <SelectableCard
                      key={o.label}
                      selected={answers.involvement === o.label}
                      onClick={() => !readOnly && update('involvement', o.label)}
                      disabled={readOnly}
                      emoji={o.emoji}
                      label={o.label}
                      description={o.desc}
                    />
                  ))}
                </div>
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 6: Team Role */}
        {step === 6 && (
          <StepWrapper icon={STEP_ICONS[6]} title="Роль в команде">
            <p className="text-sm text-muted-foreground mb-3">Выберите 1–2 роли</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEAM_ROLES.map(r => (
                <SelectableCard
                  key={r.label}
                  selected={answers.team_roles.includes(r.label)}
                  onClick={() => !readOnly && toggleTeamRole(r.label)}
                  disabled={readOnly || (answers.team_roles.length >= 2 && !answers.team_roles.includes(r.label))}
                  emoji={r.emoji}
                  label={r.label}
                  description={r.desc}
                />
              ))}
            </div>
          </StepWrapper>
        )}

        {/* Step 7: Feedback */}
        {step === 7 && (
          <StepWrapper icon={STEP_ICONS[7]} title="Обратная связь">
            <div className="space-y-4">
              <div>
                <Label>Что помогает? 💪</Label>
                <Textarea value={answers.feedback_helps} onChange={e => update('feedback_helps', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} placeholder="Напишите главное" />
              </div>
              <div>
                <Label>Что мешает? 🚧</Label>
                <Textarea value={answers.feedback_hinders} onChange={e => update('feedback_hinders', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} placeholder="Напишите главное" />
              </div>
            </div>
          </StepWrapper>
        )}

        {/* Step 8: Plans */}
        {step === 8 && (
          <StepWrapper icon={STEP_ICONS[8]} title="Планы">
            <Label>Какие цели ставите? 🎯</Label>
            <Textarea value={answers.plans} onChange={e => update('plans', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} placeholder="Что хотите сделать / изменить?" className="mt-2" />
          </StepWrapper>
        )}

        {/* Step 9: Important */}
        {step === 9 && (
          <StepWrapper icon={STEP_ICONS[9]} title="Важное">
            <Label>Что ещё хотите сказать?</Label>
            <Textarea value={answers.important} onChange={e => update('important', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} placeholder="Всё, что считаете важным" className="mt-2" />
          </StepWrapper>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-xl">
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} className="rounded-xl">Далее</Button>
          ) : (
            <div className="flex gap-2">
              {!readOnly && (
                <>
                  <Button variant="outline" onClick={handleSaveDraft} disabled={submitting} className="rounded-xl">Черновик</Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl">
                    {submitting ? 'Отправка...' : '✨ Отправить'}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
