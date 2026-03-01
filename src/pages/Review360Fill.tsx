import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, Loader2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

const QUESTIONS = [
  { key: 'communication', label: 'Коммуникация', desc: 'Насколько эффективно этот человек общается с коллегами?' },
  { key: 'teamwork', label: 'Работа в команде', desc: 'Как он/она взаимодействует с командой?' },
  { key: 'initiative', label: 'Инициативность', desc: 'Проявляет ли инициативу и предлагает ли улучшения?' },
  { key: 'responsibility', label: 'Ответственность', desc: 'Выполняет ли взятые обязательства в срок?' },
  { key: 'expertise', label: 'Профессионализм', desc: 'Уровень профессиональных навыков и экспертизы' },
  { key: 'feedback_openness', label: 'Открытость к обратной связи', desc: 'Принимает ли и даёт ли конструктивную обратную связь?' },
];

const SCORE_LABELS = ['', 'Плохо', 'Ниже среднего', 'Нормально', 'Хорошо', 'Отлично'];

export default function Review360Fill() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<any>(null);
  const [reviewee, setReviewee] = useState<Profile | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const totalSteps = QUESTIONS.length + 1; // questions + text step

  useEffect(() => { loadData(); }, [assignmentId]);

  async function loadData() {
    if (!assignmentId) return;
    const { data: asg } = await supabase.from('review_360_assignments' as any)
      .select('*').eq('id', assignmentId).single();
    if (asg) {
      setAssignment(asg);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', (asg as any).reviewee_user_id).single();
      if (prof) setReviewee(prof as unknown as Profile);
    }
    setLoading(false);
  }

  function setScore(key: string, value: number) {
    setAnswers(prev => ({ ...prev, [key]: value }));
  }

  const allQuestionsAnswered = QUESTIONS.every(q => answers[q.key] && answers[q.key] >= 1);
  const isLastStep = step === totalSteps - 1;
  const canSubmit = allQuestionsAnswered && strengths.length >= 20;

  async function handleSubmit() {
    if (!canSubmit || !assignmentId) return;
    setSubmitting(true);
    setError('');
    try {
      // Insert response
      const { error: resErr } = await supabase.from('review_360_responses' as any).insert({
        assignment_id: assignmentId,
        answers_json: { scores: answers, strengths, improvements },
        text_summary: strengths,
      });
      if (resErr) throw resErr;

      // Update assignment status
      const { error: asgErr } = await supabase.from('review_360_assignments' as any)
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', assignmentId);
      if (asgErr) throw asgErr;

      navigate('/review-360/tasks');
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
    setSubmitting(false);
  }

  if (loading) {
    return <AppLayout><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></AppLayout>;
  }

  if (!assignment || assignment.status === 'submitted') {
    return <AppLayout><div className="max-w-lg mx-auto mt-20 text-center"><p className="text-muted-foreground">Задание не найдено или уже выполнено.</p><Button className="mt-4" onClick={() => navigate('/review-360/tasks')}>К заданиям</Button></div></AppLayout>;
  }

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">Отзыв 360</h1>
          <p className="text-muted-foreground">О сотруднике: <strong className="text-foreground">{reviewee?.full_name || '—'}</strong></p>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Шаг {step + 1} из {totalSteps}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle size={16} />{error}
          </div>
        )}

        {/* Question steps */}
        {step < QUESTIONS.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{QUESTIONS[step].label}</CardTitle>
              <p className="text-sm text-muted-foreground">{QUESTIONS[step].desc}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Slider
                  value={[answers[QUESTIONS[step].key] || 3]}
                  onValueChange={v => setScore(QUESTIONS[step].key, v[0])}
                  min={1} max={5} step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {SCORE_LABELS.slice(1).map((l, i) => (
                    <span key={i} className={cn(answers[QUESTIONS[step].key] === i + 1 && "text-primary font-semibold")}>{l}</span>
                  ))}
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {Array.from({ length: answers[QUESTIONS[step].key] || 3 }).map((_, i) => (
                      <Star key={i} size={20} className="text-primary fill-primary" />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Text step */}
        {step === QUESTIONS.length && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Текстовый отзыв</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Сильные стороны *</label>
                <Textarea value={strengths} onChange={e => setStrengths(e.target.value.slice(0, 2000))} rows={4} placeholder="Что этот человек делает хорошо? (мин. 20 символов)" />
                <p className="text-xs text-muted-foreground mt-1">{strengths.length}/2000</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Что можно улучшить</label>
                <Textarea value={improvements} onChange={e => setImprovements(e.target.value.slice(0, 2000))} rows={4} placeholder="Какие зоны роста вы видите?" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            <ChevronLeft size={16} className="mr-1" /> Назад
          </Button>
          {!isLastStep ? (
            <Button onClick={() => setStep(step + 1)}>
              Далее <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? <><Loader2 size={16} className="animate-spin mr-1" />Отправка...</> : <><CheckCircle2 size={16} className="mr-1" />Отправить</>}
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
