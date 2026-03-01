import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Search, X, Heart, Loader2 } from 'lucide-react';
import { useTextProcessor } from '@/hooks/useTextProcessor';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

const KUDOS_CATEGORIES = [
  { value: 'helped_understand', label: 'Помог разобраться', emoji: '🧠' },
  { value: 'emotional_support', label: 'Поддержал в сложной ситуации', emoji: '💛' },
  { value: 'saved_deadline', label: 'Спас дедлайн', emoji: '⏰' },
  { value: 'shared_expertise', label: 'Поделился экспертизой', emoji: '📚' },
  { value: 'mentoring', label: 'Наставничество', emoji: '🌱' },
  { value: 'team_support', label: 'Командная поддержка', emoji: '🤝' },
];

export default function KudosForm() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [category, setCategory] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { processText, processing } = useTextProcessor();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [profRes, kudosRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      user ? supabase.from('kudos').select('id, to_user_id, created_at')
        .eq('from_user_id', user.id)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()) : null,
    ]);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (kudosRes?.data) setMonthlyCount(kudosRes.data.length);
  }

  const otherUsers = useMemo(() => profiles.filter(p => p.id !== user?.id), [profiles, user]);
  const filteredUsers = useMemo(() => otherUsers.filter(p => p.full_name.toLowerCase().includes(userSearch.toLowerCase())), [otherUsers, userSearch]);
  const selectedUser = useMemo(() => profiles.find(p => p.id === toUserId), [profiles, toUserId]);

  const remaining = 5 - monthlyCount;
  const isValid = toUserId && category && remaining > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      // Check 7-day cooldown
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentKudos } = await supabase.from('kudos')
        .select('id')
        .eq('from_user_id', user.id)
        .eq('to_user_id', toUserId)
        .gte('created_at', sevenDaysAgo);

      if (recentKudos && recentKudos.length > 0) {
        setError('Вы уже отправляли kudos этому сотруднику в последние 7 дней');
        setSubmitting(false);
        return;
      }

      // Process comment with AI if present
      let processedComment = comment || null;
      if (comment && comment.trim().length > 0) {
        const textResult = await processText(comment, 'kudos');
        if (textResult?.status === 'INVALID') {
          setSubmitting(false);
          return;
        }
        processedComment = textResult?.processed_text || comment;
      }

      const { error: insertErr } = await supabase.from('kudos').insert({
        from_user_id: user.id,
        to_user_id: toUserId,
        category,
        comment: processedComment,
      } as any);
      if (insertErr) throw insertErr;
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setToUserId('');
    setCategory('');
    setComment('');
    setSubmitted(false);
    setUserSearch('');
    loadData();
  }

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
            <Heart size={32} className="text-positive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Kudos отправлен! 🎉</h2>
          <p className="text-muted-foreground mb-6">Благодарность помогает строить сильную команду</p>
          <Button onClick={resetForm}>Отправить ещё</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <Heart size={24} className="text-positive" />
          <h1 className="text-2xl font-bold">Отправить Kudos</h1>
        </div>
        <p className="text-muted-foreground mb-2">Поблагодарите коллегу за помощь</p>
        <p className="text-sm mb-6">
          <Badge variant={remaining > 0 ? 'secondary' : 'destructive'}>
            Осталось {remaining} из 5 kudos в этом месяце
          </Badge>
        </p>

        {remaining <= 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            Вы использовали все 5 kudos в этом месяце. Подождите до следующего месяца.
          </CardContent></Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle size={16} />{error}
              </div>
            )}

            {/* Recipient */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Кому</CardTitle></CardHeader>
              <CardContent>
                {selectedUser ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                    <span className="font-medium flex-1">{selectedUser.full_name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setToUserId(''); setUserSearch(''); }}><X size={14} /></Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={userSearch} onChange={e => { setUserSearch(e.target.value); if (!dropdownOpen) setDropdownOpen(true); }} onFocus={() => setDropdownOpen(true)} onBlur={() => setTimeout(() => setDropdownOpen(false), 200)} placeholder="Начните вводить имя..." className="pl-9" autoComplete="off" />
                    {dropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {filteredUsers.length > 0 ? filteredUsers.map(u => (
                          <button key={u.id} type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors" onMouseDown={e => e.preventDefault()} onClick={() => { setToUserId(u.id); setUserSearch(''); setDropdownOpen(false); }}>{u.full_name}</button>
                        )) : <p className="text-sm text-muted-foreground p-3">Не найден</p>}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Category */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">За что благодарите?</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {KUDOS_CATEGORIES.map(cat => (
                    <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                      className={cn("flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all",
                        category === cat.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted"
                      )}>
                      <span className="text-lg">{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Comment */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Комментарий (необязательно)</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Расскажите подробнее..." rows={3} maxLength={300} />
                <span className="text-xs text-muted-foreground mt-1 block text-right">{comment.length}/300</span>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full" disabled={!isValid || submitting || processing}>
              {processing ? <><Loader2 size={16} className="animate-spin mr-2" />Проверяем текст...</> : submitting ? 'Отправка...' : '💜 Отправить Kudos'}
            </Button>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
