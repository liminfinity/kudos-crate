import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { FeedbackLayout } from '@/components/FeedbackLayout';
import { MiraHint } from '@/components/MiraHint';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CheckCircle2, AlertCircle, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

const STRENGTHS_OPTIONS = [
  'Коммуникация', 'Инициативность', 'Ответственность', 'Экспертиза',
  'Наставничество', 'Работа в команде', 'Лидерство', 'Креативность',
  'Аналитическое мышление', 'Стрессоустойчивость',
];

const WEAKNESSES_OPTIONS = [
  'Коммуникация', 'Планирование', 'Делегирование', 'Приоритизация',
  'Обратная связь', 'Конфликтность', 'Прокрастинация', 'Самоорганизация',
  'Гибкость', 'Внимание к деталям',
];

const PERIOD_OPTIONS = [
  { value: '2026', label: '2026 год' },
  { value: '2025', label: '2025 год' },
  { value: 'H1-2026', label: '1-е полугодие 2026' },
  { value: 'H2-2025', label: '2-е полугодие 2025' },
  { value: 'Q1-2026', label: '1 квартал 2026' },
];

export default function Feedback180Form() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const presetUserId = searchParams.get('userId') || '';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toUserId, setToUserId] = useState(presetUserId);
  const [period, setPeriod] = useState('2026');
  const [strengths, setStrengths] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [textLong, setTextLong] = useState('');
  const [collaborationScore, setCollaborationScore] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadProfiles(); }, []);

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    if (data) setProfiles(data as unknown as Profile[]);
  }

  const otherUsers = useMemo(() => profiles.filter(p => p.id !== user?.id), [profiles, user]);
  const selectedUser = useMemo(() => profiles.find(p => p.id === toUserId), [profiles, toUserId]);

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter(t => t !== tag) : [...list, tag]);
  }

  const isValid = toUserId && period && textLong.length >= 200 && strengths.length > 0;

  async function handleSubmit() {
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase.from('feedback_180' as any).insert({
        from_user_id: user.id,
        to_user_id: toUserId,
        period,
        strengths,
        weaknesses,
        text_long: textLong,
        collaboration_score: collaborationScore,
      });
      if (err) throw err;
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message || 'Ошибка при отправке');
    }
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
          <CheckCircle2 size={32} className="text-positive" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Отзыв 180 отправлен</h2>
        <p className="text-muted-foreground mb-6">Спасибо! Ваша характеристика будет доступна руководителю.</p>
        <Button onClick={() => { setSubmitted(false); setTextLong(''); setStrengths([]); setWeaknesses([]); }}>Написать ещё</Button>
      </div>
    );
  }

  const scoreLabels = ['', 'Сложно', 'Ниже среднего', 'Нормально', 'Хорошо', 'Отлично'];

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
        <MiraHint variant="tip" className="mb-4">Общая характеристика коллеги. Опишите сильные стороны и зоны роста.</MiraHint>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle size={16} />{error}
          </div>
        )}

        <div className="space-y-6">
          {/* Recipient & Period */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">О ком и за какой период</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Сотрудник</label>
                {presetUserId && selectedUser ? (
                  <div className="p-3 rounded-lg border bg-muted/30 font-medium">{selectedUser.full_name}</div>
                ) : (
                  <Select value={toUserId} onValueChange={setToUserId}>
                    <SelectTrigger><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger>
                    <SelectContent>
                      {otherUsers.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Период</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Strengths */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Сильные стороны</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {STRENGTHS_OPTIONS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(strengths, setStrengths, tag)}
                    className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      strengths.includes(tag) ? "bg-positive/15 border-positive/40 text-positive" : "bg-card border-border hover:bg-positive/5"
                    )}>
                    {tag}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weaknesses */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Зоны роста</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {WEAKNESSES_OPTIONS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag(weaknesses, setWeaknesses, tag)}
                    className={cn("rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                      weaknesses.includes(tag) ? "bg-negative/15 border-negative/40 text-negative" : "bg-card border-border hover:bg-negative/5"
                    )}>
                    {tag}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Collaboration Score */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Общая оценка сотрудничества</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Slider value={[collaborationScore]} onValueChange={v => setCollaborationScore(v[0])} min={1} max={5} step={1} className="flex-1" />
                <div className="flex items-center gap-1 min-w-[100px]">
                  {Array.from({ length: collaborationScore }).map((_, i) => (
                    <Star key={i} size={16} className="text-primary fill-primary" />
                  ))}
                  <span className="text-sm text-muted-foreground ml-1">{scoreLabels[collaborationScore]}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Long text */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Развёрнутая характеристика *</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={textLong} onChange={e => setTextLong(e.target.value.slice(0, 6000))} rows={10}
                placeholder="Опишите сотрудника: как работает, взаимодействует с командой, подход к задачам, что стоит развивать. Минимум 200 символов." />
              <div className="flex justify-between mt-1">
                <p className={cn("text-xs", textLong.length < 200 ? "text-destructive" : "text-muted-foreground")}>
                  {textLong.length < 200 ? `Ещё ${200 - textLong.length} символов` : '✓ Достаточно'}
                </p>
                <p className="text-xs text-muted-foreground">{textLong.length}/6000</p>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} size="lg" className="w-full" disabled={!isValid || submitting}>
            {submitting ? <><Loader2 size={16} className="animate-spin mr-2" />Отправка...</> : 'Отправить отзыв 180'}
          </Button>
      </div>
    </div>
  );
}
