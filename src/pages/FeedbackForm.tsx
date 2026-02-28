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

import { CheckCircle2, Plus, AlertCircle, Search, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, WorkEpisode, Subcategory, SentimentType } from '@/lib/supabase-types';

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

  // Separate normal vs critical subcategories
  const normalSubcats = useMemo(() => subcategories.filter(s => !s.is_critical), [subcategories]);
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
      const feedbackPayload: any = {
        sentiment: derivedSentiment,
        comment,
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

          {/* Normal Subcategories */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Подкатегории <span className="text-muted-foreground font-normal">(1–3)</span></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {normalSubcats.map(sub => (
                  <Badge key={sub.id} variant={selectedSubs.includes(sub.id) ? 'default' : 'outline'}
                    className={cn("cursor-pointer text-sm py-1.5 px-3 transition-all",
                      selectedSubs.includes(sub.id) ? sub.sentiment === 'positive' ? 'bg-positive hover:bg-positive/90' : 'bg-negative hover:bg-negative/90' : 'hover:bg-muted',
                      selectedSubs.length >= 3 && !selectedSubs.includes(sub.id) && 'opacity-40 cursor-not-allowed'
                    )}
                    onClick={() => toggleSub(sub.id)}>{sub.name}</Badge>
                ))}
              </div>
              {selectedSubs.length === 0 && <p className="text-xs text-muted-foreground mt-2">Выберите хотя бы одну подкатегорию</p>}
            </CardContent>
          </Card>

          {/* Critical Subcategories */}
          <Card className="border-destructive/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" />
                Серьёзные нарушения
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {criticalSubcats.map(sub => (
                  <Badge key={sub.id} variant={selectedSubs.includes(sub.id) ? 'default' : 'outline'}
                    className={cn("cursor-pointer text-sm py-1.5 px-3 transition-all",
                      selectedSubs.includes(sub.id) ? 'bg-destructive hover:bg-destructive/90' : 'hover:bg-destructive/10 border-destructive/30',
                      selectedSubs.length >= 3 && !selectedSubs.includes(sub.id) && 'opacity-40 cursor-not-allowed'
                    )}
                    onClick={() => toggleSub(sub.id)}>{sub.name}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comment */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Комментарий</CardTitle></CardHeader>
            <CardContent>
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

          <Button type="submit" size="lg" className="w-full" disabled={!isValid || submitting}>
            {submitting ? 'Отправка...' : isUpdate ? 'Обновить отзыв' : hasCriticalSelected ? '⚠️ Отправить отзыв о нарушении' : 'Отправить отзыв'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
