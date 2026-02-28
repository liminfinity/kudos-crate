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
import { CheckCircle2, Plus, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, WorkEpisode, Subcategory, SentimentType } from '@/lib/supabase-types';

export default function FeedbackForm() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<WorkEpisode[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  
  const [episodeId, setEpisodeId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [sentiment, setSentiment] = useState<SentimentType | ''>('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);
  const [isUpdate, setIsUpdate] = useState(false);
  
  // New episode dialog
  const [newEpOpen, setNewEpOpen] = useState(false);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [newEpDate, setNewEpDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEpDesc, setNewEpDesc] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [epRes, profRes, subRes] = await Promise.all([
      supabase.from('work_episodes').select('*').order('date', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('subcategories').select('*').eq('is_active', true).order('sort_order'),
    ]);
    if (epRes.data) setEpisodes(epRes.data as unknown as WorkEpisode[]);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (subRes.data) setSubcategories(subRes.data as unknown as Subcategory[]);
  }

  // Check existing feedback when episode + recipient selected
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
      setSentiment(data.sentiment as SentimentType);
      setComment(data.comment);
      // Load existing subcategories
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

  const filteredSubs = useMemo(
    () => subcategories.filter(s => sentiment && s.sentiment === sentiment),
    [subcategories, sentiment]
  );

  const otherUsers = useMemo(
    () => profiles.filter(p => p.id !== user?.id),
    [profiles, user]
  );

  function toggleSub(id: string) {
    setSelectedSubs(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const isValid = episodeId && toUserId && sentiment && selectedSubs.length >= 1 && selectedSubs.length <= 3 && comment.length >= 10 && comment.length <= 500;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;
    setSubmitting(true);
    setError('');

    try {
      if (isUpdate && existingFeedbackId) {
        // Update existing
        const { error: updateErr } = await supabase
          .from('feedback')
          .update({ sentiment, comment })
          .eq('id', existingFeedbackId);
        if (updateErr) throw updateErr;

        // Delete old subcategories and insert new
        await supabase.from('feedback_subcategories').delete().eq('feedback_id', existingFeedbackId);
        const subInserts = selectedSubs.map(sid => ({ feedback_id: existingFeedbackId, subcategory_id: sid }));
        const { error: subErr } = await supabase.from('feedback_subcategories').insert(subInserts);
        if (subErr) throw subErr;
      } else {
        // Insert new
        const { data: fb, error: fbErr } = await supabase
          .from('feedback')
          .insert({
            episode_id: episodeId,
            from_user_id: user.id,
            to_user_id: toUserId,
            sentiment,
            comment,
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
    setEpisodeId('');
    setToUserId('');
    setSentiment('');
    setSelectedSubs([]);
    setComment('');
    setSubmitted(false);
    setExistingFeedbackId(null);
    setIsUpdate(false);
  }

  if (submitted) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto mt-20 text-center animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-positive/10 mb-6">
            <CheckCircle2 size={32} className="text-positive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Спасибо!</h2>
          <p className="text-muted-foreground mb-6">
            {isUpdate ? 'Ваш отзыв обновлён.' : 'Ваш отзыв успешно отправлен.'}
          </p>
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
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {isUpdate && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary text-sm">
              <AlertCircle size={16} />
              Вы уже оставляли отзыв по этому эпизоду для этого сотрудника. Вы можете обновить его.
            </div>
          )}

          {/* Episode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Контекст (эпизод / задача)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={episodeId} onValueChange={setEpisodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите эпизод" />
                </SelectTrigger>
                <SelectContent>
                  {episodes.map(ep => (
                    <SelectItem key={ep.id} value={ep.id}>
                      {ep.title} ({ep.date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={newEpOpen} onOpenChange={setNewEpOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1">
                    <Plus size={14} /> Создать новый эпизод
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Новый эпизод</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Название</Label>
                      <Input value={newEpTitle} onChange={e => setNewEpTitle(e.target.value)} placeholder="Спринт 15, Ретро, Релиз..." />
                    </div>
                    <div>
                      <Label>Дата</Label>
                      <Input type="date" value={newEpDate} onChange={e => setNewEpDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Описание (необязательно)</Label>
                      <Textarea value={newEpDesc} onChange={e => setNewEpDesc(e.target.value)} />
                    </div>
                    <Button onClick={handleCreateEpisode} disabled={!newEpTitle.trim()}>Создать</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Recipient */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Кому</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {otherUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Sentiment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Тип отзыва</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setSentiment('positive'); setSelectedSubs([]); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all font-medium",
                    sentiment === 'positive'
                      ? "border-positive bg-positive/10 text-positive"
                      : "border-border hover:border-positive/40"
                  )}
                >
                  <ThumbsUp size={20} /> Позитивный
                </button>
                <button
                  type="button"
                  onClick={() => { setSentiment('negative'); setSelectedSubs([]); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-all font-medium",
                    sentiment === 'negative'
                      ? "border-negative bg-negative/10 text-negative"
                      : "border-border hover:border-negative/40"
                  )}
                >
                  <ThumbsDown size={20} /> Негативный
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Subcategories */}
          {sentiment && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Подкатегории <span className="text-muted-foreground font-normal">(1–3)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {filteredSubs.map(sub => (
                    <Badge
                      key={sub.id}
                      variant={selectedSubs.includes(sub.id) ? 'default' : 'outline'}
                      className={cn(
                        "cursor-pointer text-sm py-1.5 px-3 transition-all",
                        selectedSubs.includes(sub.id)
                          ? sentiment === 'positive' ? 'bg-positive hover:bg-positive/90' : 'bg-negative hover:bg-negative/90'
                          : 'hover:bg-muted',
                        selectedSubs.length >= 3 && !selectedSubs.includes(sub.id) && 'opacity-40 cursor-not-allowed'
                      )}
                      onClick={() => toggleSub(sub.id)}
                    >
                      {sub.name}
                    </Badge>
                  ))}
                </div>
                {selectedSubs.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">Выберите хотя бы одну подкатегорию</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Comment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Комментарий</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Опишите ситуацию подробнее (минимум 10 символов)..."
                rows={4}
                maxLength={500}
              />
              <div className="flex justify-between mt-1.5">
                <span className={cn("text-xs", comment.length < 10 ? "text-destructive" : "text-muted-foreground")}>
                  {comment.length < 10 ? `Минимум 10 символов` : ''}
                </span>
                <span className="text-xs text-muted-foreground">{comment.length}/500</span>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={!isValid || submitting}>
            {submitting ? 'Отправка...' : isUpdate ? 'Обновить отзыв' : 'Отправить отзыв'}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
