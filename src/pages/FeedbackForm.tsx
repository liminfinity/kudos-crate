import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { CheckCircle2, Plus, AlertCircle, Search, X, AlertTriangle, Loader2 } from 'lucide-react';
import { useTextProcessor } from '@/hooks/useTextProcessor';
import { cn } from '@/lib/utils';
import type { Profile, WorkEpisode, Subcategory, SentimentType } from '@/lib/supabase-types';
import { MiraHint } from '@/components/MiraHint';
import { MiraFillAssistant } from '@/components/MiraFillAssistant';
import { getSubcategoryIcon } from '@/lib/subcategory-icons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SubcategoryExt extends Subcategory {
  is_critical: boolean;
}

export default function FeedbackForm() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<WorkEpisode[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryExt[]>([]);
  
  const [episodeId, setEpisodeId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);
  
  const [userSearch, setUserSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { processText, processing } = useTextProcessor();

  const [newEpOpen, setNewEpOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpDate, setNewEpDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEpDesc, setNewEpDesc] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [epRes, profRes, subRes] = await Promise.all([
      supabase.from('work_episodes').select('*').order('date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('subcategories').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (epRes.data) setEpisodes(epRes.data as unknown as WorkEpisode[]);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (subRes.data) setSubcategories(subRes.data as unknown as SubcategoryExt[]);
  }

  useEffect(() => {
    if (!episodeId || !toUserId || !user) return;
    checkExisting();
  }, [episodeId, toUserId]);

  async function checkExisting() {
    const { data } = await supabase
      .from('feedback')
      .select('id, sentiment, comment')
      .eq('episode_id', episodeId)
      .eq('to_user_id', toUserId)
      .eq('from_user_id', user!.id)
      .maybeSingle();
    
    if (data) {
      setExistingFeedbackId(data.id);
      setIsUpdate(true);
      setComment(data.comment);
      const { data: subs } = await supabase
        .from('feedback_subcategories')
        .select('subcategory_id')
        .eq('feedback_id', data.id);
      if (subs) setSelectedSubs(subs.map(s => s.subcategory_id));
    } else {
      setExistingFeedbackId(null);
      setIsUpdate(false);
    }
  }

  const otherUsers = useMemo(() => profiles.filter(p => p.id !== user?.id), [profiles, user]);
  const filteredUsers = useMemo(() => otherUsers.filter(p => p.full_name.toLowerCase().includes(userSearch.toLowerCase())), [otherUsers, userSearch]);
  const selectedUser = useMemo(() => profiles.find(p => p.id === toUserId), [profiles, toUserId]);

  // Separate by sentiment, then critical
  const positiveSubcats = useMemo(() => subcategories.filter(s => s.sentiment === 'positive' && !s.is_critical), [subcategories]);
  const negativeSubcats = useMemo(() => subcategories.filter(s => s.sentiment === 'negative' && !s.is_critical), [subcategories]);
  const criticalSubcats = useMemo(() => subcategories.filter(s => s.is_critical), [subcategories]);

  // Check if any critical subcategory is selected
  const hasCriticalSelected = useMemo(() => {
    return selectedSubs.some(id => criticalSubcats.some(cs => cs.id === id));
  }, [selectedSubs, criticalSubcats]);

  function toggleSub(id: string) {
    setSelectedSubs(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const derivedSentiment = useMemo((): SentimentType => {
    if (selectedSubs.length === 0) return 'positive';
    const posCount = selectedSubs.filter(id => {
      const sub = subcategories.find(s => s.id === id);
      return sub?.sentiment === 'positive';
    }).length;
    return posCount >= selectedSubs.length / 2 ? 'positive' : 'negative';
  }, [selectedSubs, subcategories]);

  const minCommentLength = hasCriticalSelected ? 50 : 10;
  const isValid = episodeId && toUserId && selectedSubs.length >= 1 && selectedSubs.length <= 3 && comment.length >= minCommentLength && comment.length <= 500;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      // Process text with AI
      const textResult = await processText(comment, hasCriticalSelected ? 'critical' : 'feedback');
      if (textResult?.status === 'INVALID') {
        setSubmitting(false);
        return;
      }
      const processedComment = textResult?.processed_text || comment;

      const feedbackPayload: any = {
        sentiment: derivedSentiment,
        comment: processedComment,
        is_critical: hasCriticalSelected,
      };

      if (isUpdate && existingFeedbackId) {
        const { error: updateErr } = await supabase
          .from('feedback')
          .update(feedbackPayload)
          .eq('id', existingFeedbackId);
        if (updateErr) throw updateErr;

        await supabase.from('feedback_subcategories').delete().eq('feedback_id', existingFeedbackId);
        const subInserts = selectedSubs.map(sid => ({ feedback_id: existingFeedbackId, subcategory_id: sid }));
        const { error: subErr } = await supabase.from('feedback_subcategories').insert(subInserts);
        if (subErr) throw subErr;
      } else {
        const { data: fb, error: fbErr } = await supabase
          .from('feedback')
          .insert({
            episode_id: episodeId,
            from_user_id: user.id,
            to_user_id: toUserId,
            ...feedbackPayload,
          })
          .select('id')
          .single();
        if (fbErr) throw fbErr;

        const subInserts = selectedSubs.map(sid => ({ feedback_id: fb.id, subcategory_id: sid }));
        const { error: subErr } = await supabase.from('feedback_subcategories').insert(subInserts);
        if (subErr) throw subErr;
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateEpisode() {
    if (!newEpTitle.trim() || !user) return;
    const { data, error } = await supabase
      .from('work_episodes')
      .insert({ title: newEpTitle, date: newEpDate, description: newEpDesc || null, created_by: user.id })
      .select('id')
      .single();
    if (data) {
      await loadData();
      setEpisodeId(data.id);
      setNewEpOpen(false);
      setNewEpTitle('');
      setNewEpDesc('');
    }
  }

  function resetForm() {
    setEpisodeId(''); setToUserId(''); setSelectedSubs([]); setComment('');
    setSubmitted(false); setExistingFeedbackId(null); setIsUpdate(false); setUserSearch('');
  }

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
            <CheckCircle2 size={32} className="text-positive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Спасибо!</h2>
          <p className="text-muted-foreground mb-6">{isUpdate ? 'Ваш отзыв обновлён.' : 'Отзыв успешно отправлен.'}</p>
          <Button onClick={resetForm}>Отправить ещё</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Новый отзыв</h1>
        <p className="text-muted-foreground mb-6">Оставьте структурированную обратную связь коллеге</p>

        <MiraHint variant="tip" className="mb-4">
          Постарайтесь описать ситуацию конкретно — это поможет коллеге понять, что именно было ценно или что можно улучшить.
        </MiraHint>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle size={16} />{error}
            </div>
          )}

          {isUpdate && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
              <AlertCircle size={16} />
              Вы уже оставляли отзыв по этому эпизоду для этого сотрудника. Вы можете обновить его.
            </div>
          )}

          {/* Critical incident warning */}
          {hasCriticalSelected && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">⚠️ Вы указываете серьёзное нарушение</p>
                <p className="mt-1">Это будет зафиксировано отдельно и будет видно только HR и администраторам. Комментарий обязателен (минимум 50 символов).</p>
              </div>
            </div>
          )}

          {/* Episode */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Контекст (эпизод / задача)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={episodeId} onValueChange={setEpisodeId}>
                <SelectTrigger><SelectValue placeholder="Выберите эпизод" /></SelectTrigger>
                <SelectContent>
                  {episodes.map(ep => <SelectItem key={ep.id} value={ep.id}>{ep.title} ({ep.date})</SelectItem>)}
                </SelectContent>
              </Select>
              <Dialog open={newEpOpen} onOpenChange={setNewEpOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1"><Plus size={14} /> Создать новый эпизод</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Новый эпизод</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Название</Label><Input value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="Спринт 15, Ретро, Релиз..." /></div>
                    <div><Label>Дата</Label><Input type="date" value={newEpDate} onChange={e => setNewEpDate(e.target.value)} /></div>
                    <div><Label>Описание (необязательно)</Label><Textarea value={newEpDesc} onChange={e => setNewEpDesc(e.target.value)} /></div>
                    <Button onClick={handleCreateEpisode} disabled={!newEpTitle.trim()}>Создать</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

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
                  <Input value={userSearch} onChange={e => { setUserSearch(e.target.value); if (!userDropdownOpen) setUserDropdownOpen(true); }} onFocus={() => setUserDropdownOpen(true)} onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)} placeholder="Начните вводить имя сотрудника..." className="pl-9" autoComplete="off" />
                  {userDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <button key={u.id} type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors" onMouseDown={e => e.preventDefault()} onClick={() => { setToUserId(u.id); setUserSearch(''); setUserDropdownOpen(false); }}>{u.full_name}</button>
                      )) : <p className="text-sm text-muted-foreground p-3">Сотрудник не найден</p>}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subcategories — split by sentiment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Подкатегории <span className="text-muted-foreground font-normal">(1–3 всего)</span></CardTitle>
              {selectedSubs.length >= 3 && (
                <p className="text-xs text-chart-4 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> Достигнут лимит — снимите выбор, чтобы изменить
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Positive section */}
              <div>
                <p className="text-xs font-semibold text-positive mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle2 size={13} /> Позитивные
                </p>
                <div className="flex flex-wrap gap-2">
                  {positiveSubcats.map(sub => {
                    const Icon = getSubcategoryIcon(sub.name);
                    const selected = selectedSubs.includes(sub.id);
                    const disabled = selectedSubs.length >= 3 && !selected;
                    return (
                      <Tooltip key={sub.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => !disabled && toggleSub(sub.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                              selected
                                ? "bg-positive/15 border-positive/40 text-positive ring-1 ring-positive/20"
                                : "bg-card border-border text-foreground hover:bg-positive/5 hover:border-positive/25",
                              disabled && "opacity-35 cursor-not-allowed"
                            )}
                          >
                            <Icon size={15} />
                            {sub.name}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Позитивная подкатегория</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Negative section */}
              <div>
                <p className="text-xs font-semibold text-negative mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <AlertCircle size={13} /> Негативные
                </p>
                <div className="flex flex-wrap gap-2">
                  {negativeSubcats.map(sub => {
                    const Icon = getSubcategoryIcon(sub.name);
                    const selected = selectedSubs.includes(sub.id);
                    const disabled = selectedSubs.length >= 3 && !selected;
                    return (
                      <Tooltip key={sub.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => !disabled && toggleSub(sub.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                              selected
                                ? "bg-negative/15 border-negative/40 text-negative ring-1 ring-negative/20"
                                : "bg-card border-border text-foreground hover:bg-negative/5 hover:border-negative/25",
                              disabled && "opacity-35 cursor-not-allowed"
                            )}
                          >
                            <Icon size={15} />
                            {sub.name}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Негативная подкатегория</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {selectedSubs.length === 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={12} /> Выберите хотя бы одну подкатегорию
                </p>
              )}
              {selectedSubs.length > 0 && (
                <p className="text-xs text-muted-foreground">Выбрано: {selectedSubs.length}/3</p>
              )}
            </CardContent>
          </Card>

          {/* Critical Subcategories */}
          {criticalSubcats.length > 0 && (
            <Card className="border-destructive/20 bg-destructive/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle size={16} className="text-destructive" />
                  Серьёзные нарушения
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Будет видно только HR и администраторам</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {criticalSubcats.map(sub => {
                    const Icon = getSubcategoryIcon(sub.name);
                    const selected = selectedSubs.includes(sub.id);
                    const disabled = selectedSubs.length >= 3 && !selected;
                    return (
                      <Tooltip key={sub.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => !disabled && toggleSub(sub.id)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                              selected
                                ? "bg-destructive/15 border-destructive/40 text-destructive ring-1 ring-destructive/20"
                                : "bg-card border-destructive/20 text-foreground hover:bg-destructive/5 hover:border-destructive/30",
                              disabled && "opacity-35 cursor-not-allowed"
                            )}
                          >
                            <Icon size={15} />
                            {sub.name}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Серьёзное нарушение — будет видно HR</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comment */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Комментарий</CardTitle>
                <MiraFillAssistant context="feedback" onResult={(text) => setComment(text)} />
              </div>
            </CardHeader>
            <CardContent>
              {comment.length > 200 && (
                <MiraHint variant="intervention" className="mb-3">
                  Текст довольно длинный. Могу помочь структурировать — выделить главное и убрать лишнее.
                </MiraHint>
              )}
              <Textarea value={comment} onChange={e => setComment(e.target.value)}
                placeholder={hasCriticalSelected ? "Опишите ситуацию подробно (минимум 50 символов)..." : "Опишите ситуацию подробнее (минимум 10 символов)..."}
                rows={4} maxLength={500} />
              <div className="flex justify-between mt-1.5">
                <span className={cn("text-xs", comment.length < minCommentLength ? "text-destructive" : "text-muted-foreground")}>
                  {comment.length < minCommentLength ? `Минимум ${minCommentLength} символов` : ''}
                </span>
                <span className="text-xs text-muted-foreground">{comment.length}/500</span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={!isValid || submitting || processing}>
            {processing ? <><Loader2 size={16} className="animate-spin mr-2" />Проверяем текст...</> : submitting ? 'Отправка...' : isUpdate ? 'Обновить отзыв' : hasCriticalSelected ? '⚠️ Отправить отзыв о нарушении' : 'Отправить отзыв'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
