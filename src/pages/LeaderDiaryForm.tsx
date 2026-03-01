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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextProcessor } from '@/hooks/useTextProcessor';

const STEPS = [
  'Общая информация',
  'Общая оценка периода',
  'Проекты и задачи',
  'Состояние команды',
  'Люди',
  'Взаимодействие и процессы',
  'Риски',
  'Управленческие действия',
  'Свободный комментарий',
];

interface DiaryAnswers {
  fill_date: string;
  period_overall: string;
  workload: string;
  controllability: string;
  key_projects: string;
  projects_good: string;
  projects_stuck: string;
  projects_deadline_risk: string;
  projects_quality_issues: string;
  projects_completed: string;
  projects_failed: string;
  delay_reasons: string[];
  delay_reasons_other: string;
  team_state: string;
  burnout_signs: string;
  conflicts: string;
  involvement_level: string;
  autonomy_level: string;
  notable_employees: string;
  notable_reasons: string[];
  notable_reasons_other: string;
  repeated_difficulties: string;
  difficulty_employees: string;
  difficulty_types: string[];
  difficulty_types_other: string;
  difficulty_impact: string;
  good_processes: string;
  bad_processes: string;
  failure_areas: string[];
  failure_areas_other: string;
  hard_teams: string;
  good_teams: string;
  key_risks: string;
  attention_needed: string;
  deadline_threats: string;
  resource_needs: string[];
  resource_needs_other: string;
  decisions_made: string;
  what_worked: string;
  what_failed: string;
  next_period_changes: string;
  help_needed: string;
  free_comment: string;
}

const defaultDiary: DiaryAnswers = {
  fill_date: new Date().toISOString().split('T')[0],
  period_overall: '', workload: '', controllability: '',
  key_projects: '', projects_good: '', projects_stuck: '',
  projects_deadline_risk: '', projects_quality_issues: '',
  projects_completed: '', projects_failed: '',
  delay_reasons: [], delay_reasons_other: '',
  team_state: '', burnout_signs: '', conflicts: '',
  involvement_level: '', autonomy_level: '',
  notable_employees: '', notable_reasons: [], notable_reasons_other: '',
  repeated_difficulties: '', difficulty_employees: '',
  difficulty_types: [], difficulty_types_other: '', difficulty_impact: '',
  good_processes: '', bad_processes: '',
  failure_areas: [], failure_areas_other: '',
  hard_teams: '', good_teams: '',
  key_risks: '', attention_needed: '', deadline_threats: '',
  resource_needs: [], resource_needs_other: '',
  decisions_made: '', what_worked: '', what_failed: '',
  next_period_changes: '', help_needed: '', free_comment: '',
};

const DELAY_REASONS = ['Нехватка ресурсов', 'Плохая коммуникация', 'Смена приоритетов', 'Внешние блокеры', 'Неопределённость требований'];
const NOTABLE_REASONS = ['Инициативность', 'Надёжность', 'Скорость', 'Качество', 'Лидерство', 'Помощь команде', 'Коммуникация'];
const DIFFICULTY_TYPES = ['Сроки', 'Ответственность', 'Коммуникация', 'Качество', 'Мотивация', 'Конфликтность', 'Вовлечённость'];
const FAILURE_AREAS = ['Коммуникация внутри команды', 'Коммуникация между командами', 'Постановка задач', 'Приоритизация', 'Согласования', 'Передача информации', 'Контроль сроков'];
const RESOURCE_NEEDS = ['Люди', 'Время', 'Экспертиза', 'Управленческое внимание', 'Внешняя поддержка'];

function RadioChoices({ options, value, onChange, disabled }: { options: string[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <RadioGroup value={value} onValueChange={v => !disabled && onChange(v)} disabled={disabled}>
      {options.map(o => (
        <div key={o} className="flex items-center gap-2 mb-1.5">
          <RadioGroupItem value={o} id={`r_${o}`} />
          <Label htmlFor={`r_${o}`} className="font-normal text-sm">{o}</Label>
        </div>
      ))}
    </RadioGroup>
  );
}

function CheckList({ items, selected, onToggle, disabled, other, onOtherChange }: {
  items: string[]; selected: string[]; onToggle: (v: string) => void; disabled: boolean;
  other?: string; onOtherChange?: (v: string) => void;
}) {
  return (
    <>
      {items.map(item => (
        <div key={item} className="flex items-center gap-2 mb-1.5">
          <Checkbox checked={selected.includes(item)} onCheckedChange={() => !disabled && onToggle(item)} disabled={disabled} />
          <span className="text-sm">{item}</span>
        </div>
      ))}
      {onOtherChange !== undefined && (
        <div className="flex items-center gap-2">
          <Checkbox checked={selected.includes('other')} onCheckedChange={() => !disabled && onToggle('other')} disabled={disabled} />
          <span className="text-sm">Другое:</span>
          <Input value={other || ''} onChange={e => onOtherChange(e.target.value)} className="flex-1" disabled={disabled} />
        </div>
      )}
    </>
  );
}

export default function LeaderDiaryForm() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<DiaryAnswers>({ ...defaultDiary });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [assignmentData, setAssignmentData] = useState<any>(null);
  const [error, setError] = useState('');
  const { processText, processing } = useTextProcessor();

  useEffect(() => { loadData(); }, [assignmentId]);

  async function loadData() {
    const { data } = await supabase.from('survey_assignments').select(`
      id, cycle_id, user_id, status, team_id,
      cycle:survey_cycles!inner(label, period_start, period_end, due_date,
        template:survey_templates!inner(name, type))
    `).eq('id', assignmentId!).single();

    if (data) {
      setAssignmentData(data);
      if ((data as any).status === 'submitted') setReadOnly(true);
      const { data: resp } = await supabase.from('survey_responses')
        .select('answers_json').eq('assignment_id', assignmentId!).maybeSingle();
      if (resp?.answers_json) setAnswers({ ...defaultDiary, ...(resp.answers_json as any) });
    }
    setLoading(false);
  }

  function update<K extends keyof DiaryAnswers>(key: K, value: DiaryAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  function toggleArr(key: keyof DiaryAnswers, item: string) {
    const arr = answers[key] as string[];
    update(key, arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);
  }

  async function handleSaveDraft() {
    if (!assignmentId || readOnly) return;
    setSubmitting(true);
    try {
      await supabase.from('survey_assignments').update({ status: 'in_progress' as any, started_at: new Date().toISOString() }).eq('id', assignmentId);
      const { data: existing } = await supabase.from('survey_responses').select('id').eq('assignment_id', assignmentId).maybeSingle();
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
    setSubmitting(true); setError('');
    try {
      // Process text fields with AI
      const textFields: (keyof DiaryAnswers)[] = ['key_projects', 'projects_good', 'projects_stuck', 'projects_deadline_risk', 'projects_quality_issues', 'projects_completed', 'projects_failed', 'notable_employees', 'difficulty_employees', 'difficulty_impact', 'good_processes', 'bad_processes', 'hard_teams', 'good_teams', 'key_risks', 'attention_needed', 'deadline_threats', 'decisions_made', 'what_worked', 'what_failed', 'next_period_changes', 'help_needed', 'free_comment'];
      const processedAnswers = { ...answers };
      for (const field of textFields) {
        const val = processedAnswers[field];
        if (typeof val === 'string' && val.trim().length > 3) {
          const result = await processText(val, 'manager-diary');
          if (result?.processed_text) {
            (processedAnswers as any)[field] = result.processed_text;
          }
        }
      }
      setAnswers(processedAnswers);

      const { data: existing } = await supabase.from('survey_responses').select('id').eq('assignment_id', assignmentId).maybeSingle();
      if (existing) {
        await supabase.from('survey_responses').update({ answers_json: processedAnswers as any }).eq('id', existing.id);
      } else {
        await supabase.from('survey_responses').insert({ assignment_id: assignmentId, answers_json: processedAnswers as any });
      }
      await supabase.from('survey_assignments').update({ status: 'submitted' as any, submitted_at: new Date().toISOString() }).eq('id', assignmentId);
      setSubmitted(true);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  if (loading) return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
            <CheckCircle2 size={32} className="text-positive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Дневник отправлен!</h2>
          <p className="text-muted-foreground mb-6">Спасибо за заполнение.</p>
          <Button onClick={() => navigate('/leader-diary')}>К дневникам</Button>
        </div>
      </AppLayout>
    );
  }

  const cycleLabel = (assignmentData as any)?.cycle?.label || '';
  const periodStr = `${(assignmentData as any)?.cycle?.period_start} — ${(assignmentData as any)?.cycle?.period_end}`;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Дневник руководителя</h1>
            <p className="text-sm text-muted-foreground">{cycleLabel} • {periodStr}</p>
          </div>
          {readOnly && <Badge variant="secondary">Только просмотр</Badge>}
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button key={i} onClick={() => setStep(i)} className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            )}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

        {step === 0 && (
          <Card><CardHeader><CardTitle className="text-base">Общая информация</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Руководитель</Label><Input value={profile?.full_name || ''} disabled /></div>
              <div><Label>Период</Label><Input value={periodStr} disabled /></div>
              <div><Label>Дата заполнения</Label><Input type="date" value={answers.fill_date} onChange={e => update('fill_date', e.target.value)} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card><CardHeader><CardTitle className="text-base">1. Общая оценка периода</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label className="mb-2 block">Как в целом прошёл этот период?</Label>
                <RadioChoices options={['Очень хорошо', 'Скорее хорошо', 'Нейтрально', 'Скорее плохо', 'Плохо']} value={answers.period_overall} onChange={v => update('period_overall', v)} disabled={readOnly} />
              </div>
              <div><Label className="mb-2 block">Команда справлялась с нагрузкой?</Label>
                <RadioChoices options={['Отлично', 'Нормально', 'С перегрузкой', 'Критически тяжело']} value={answers.workload} onChange={v => update('workload', v)} disabled={readOnly} />
              </div>
              <div><Label className="mb-2 block">Управляемость работы?</Label>
                <RadioChoices options={['Полностью', 'В основном', 'Частично', 'Слабо']} value={answers.controllability} onChange={v => update('controllability', v)} disabled={readOnly} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card><CardHeader><CardTitle className="text-base">2. Проекты и задачи</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Ключевые проекты/задачи</Label><Textarea value={answers.key_projects} onChange={e => update('key_projects', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label>Продвигались хорошо</Label><Textarea value={answers.projects_good} onChange={e => update('projects_good', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Буксовали</Label><Textarea value={answers.projects_stuck} onChange={e => update('projects_stuck', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Риски по срокам</Label><Textarea value={answers.projects_deadline_risk} onChange={e => update('projects_deadline_risk', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Проблемы с качеством</Label><Textarea value={answers.projects_quality_issues} onChange={e => update('projects_quality_issues', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Завершены</Label><Textarea value={answers.projects_completed} onChange={e => update('projects_completed', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Перенесены/сорваны</Label><Textarea value={answers.projects_failed} onChange={e => update('projects_failed', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Основные причины задержек</Label>
                <CheckList items={DELAY_REASONS} selected={answers.delay_reasons} onToggle={v => toggleArr('delay_reasons', v)} disabled={readOnly} other={answers.delay_reasons_other} onOtherChange={v => update('delay_reasons_other', v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card><CardHeader><CardTitle className="text-base">3. Состояние команды</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label className="mb-2 block">Общее состояние</Label><RadioChoices options={['Стабильное', 'Напряжённое', 'Перегруженное', 'Нестабильное']} value={answers.team_state} onChange={v => update('team_state', v)} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Признаки выгорания?</Label><RadioChoices options={['Да', 'Нет', 'Частично']} value={answers.burnout_signs} onChange={v => update('burnout_signs', v)} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Конфликты?</Label><RadioChoices options={['Да', 'Нет']} value={answers.conflicts} onChange={v => update('conflicts', v)} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Вовлечённость</Label><RadioChoices options={['Высокая вовлечённость', 'Средняя', 'Низкая']} value={answers.involvement_level} onChange={v => update('involvement_level', v)} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Самостоятельность</Label><RadioChoices options={['Высокая самостоятельность', 'Средняя', 'Низкая']} value={answers.autonomy_level} onChange={v => update('autonomy_level', v)} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card><CardHeader><CardTitle className="text-base">4. Люди</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Кого стоит отметить?</Label><Textarea value={answers.notable_employees} onChange={e => update('notable_employees', e.target.value.slice(0, 1000))} rows={2} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">За что?</Label>
                <CheckList items={NOTABLE_REASONS} selected={answers.notable_reasons} onToggle={v => toggleArr('notable_reasons', v)} disabled={readOnly} other={answers.notable_reasons_other} onOtherChange={v => update('notable_reasons_other', v)} />
              </div>
              <div><Label className="mb-2 block">Повторялись сложности?</Label><RadioChoices options={['Да', 'Нет']} value={answers.repeated_difficulties} onChange={v => update('repeated_difficulties', v)} disabled={readOnly} /></div>
              {answers.repeated_difficulties === 'Да' && (
                <>
                  <div><Label>Кто именно?</Label><Textarea value={answers.difficulty_employees} onChange={e => update('difficulty_employees', e.target.value.slice(0, 1000))} rows={2} disabled={readOnly} /></div>
                  <div><Label className="mb-2 block">В чём сложности?</Label>
                    <CheckList items={DIFFICULTY_TYPES} selected={answers.difficulty_types} onToggle={v => toggleArr('difficulty_types', v)} disabled={readOnly} other={answers.difficulty_types_other} onOtherChange={v => update('difficulty_types_other', v)} />
                  </div>
                  <div><Label className="mb-2 block">Влияние на команду?</Label><RadioChoices options={['Слабо', 'Умеренно', 'Заметно', 'Сильно']} value={answers.difficulty_impact} onChange={v => update('difficulty_impact', v)} disabled={readOnly} /></div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card><CardHeader><CardTitle className="text-base">5. Взаимодействие и процессы</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Хорошо работающие процессы</Label><Textarea value={answers.good_processes} onChange={e => update('good_processes', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label>Мешающие процессы</Label><Textarea value={answers.bad_processes} onChange={e => update('bad_processes', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Где возникали сбои?</Label>
                <CheckList items={FAILURE_AREAS} selected={answers.failure_areas} onToggle={v => toggleArr('failure_areas', v)} disabled={readOnly} other={answers.failure_areas_other} onOtherChange={v => update('failure_areas_other', v)} />
              </div>
              <div><Label>Сложное взаимодействие с...</Label><Textarea value={answers.hard_teams} onChange={e => update('hard_teams', e.target.value.slice(0, 1000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Хорошее взаимодействие с...</Label><Textarea value={answers.good_teams} onChange={e => update('good_teams', e.target.value.slice(0, 1000))} rows={2} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card><CardHeader><CardTitle className="text-base">6. Риски</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Ключевые риски на следующий период</Label><Textarea value={answers.key_risks} onChange={e => update('key_risks', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label>Требует особого внимания</Label><Textarea value={answers.attention_needed} onChange={e => update('attention_needed', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Угрозы срокам</Label><Textarea value={answers.deadline_threats} onChange={e => update('deadline_threats', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label className="mb-2 block">Где нужен доп. ресурс?</Label>
                <CheckList items={RESOURCE_NEEDS} selected={answers.resource_needs} onToggle={v => toggleArr('resource_needs', v)} disabled={readOnly} other={answers.resource_needs_other} onOtherChange={v => update('resource_needs_other', v)} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 7 && (
          <Card><CardHeader><CardTitle className="text-base">7. Управленческие действия</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div><Label>Решения в этом периоде</Label><Textarea value={answers.decisions_made} onChange={e => update('decisions_made', e.target.value.slice(0, 2000))} rows={3} disabled={readOnly} /></div>
              <div><Label>Что сработало</Label><Textarea value={answers.what_worked} onChange={e => update('what_worked', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Что не сработало</Label><Textarea value={answers.what_failed} onChange={e => update('what_failed', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Что хотите изменить</Label><Textarea value={answers.next_period_changes} onChange={e => update('next_period_changes', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
              <div><Label>Где нужна помощь?</Label><Textarea value={answers.help_needed} onChange={e => update('help_needed', e.target.value.slice(0, 2000))} rows={2} disabled={readOnly} /></div>
            </CardContent>
          </Card>
        )}

        {step === 8 && (
          <Card><CardHeader><CardTitle className="text-base">8. Свободный комментарий</CardTitle></CardHeader>
            <CardContent>
              <Label>Что ещё важно зафиксировать?</Label>
              <Textarea value={answers.free_comment} onChange={e => update('free_comment', e.target.value.slice(0, 2000))} rows={5} disabled={readOnly} />
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft size={16} className="mr-1" /> Назад
          </Button>
          <span className="text-sm text-muted-foreground">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>Далее <ChevronRight size={16} className="ml-1" /></Button>
          ) : (
            <div className="flex gap-2">
              {!readOnly && (
                <>
                  <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>Черновик</Button>
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
