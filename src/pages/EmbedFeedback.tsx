import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, AlertCircle, Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSubcategoryIcon } from '@/lib/subcategory-icons';
import type { Profile, Subcategory } from '@/lib/supabase-types';

export default function EmbedFeedback() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') || 'light';
  const episodeId = searchParams.get('episodeId') || '';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [episode, setEpisode] = useState<any>(null);
  const [toUserId, setToUserId] = useState('');
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    loadData();
  }, []);

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

  async function loadData() {
    const [profRes, subRes, epRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('subcategories').select('*').eq('is_active', true).order('sort_order'),
      episodeId ? supabase.from('work_episodes').select('*').eq('id', episodeId).single() : null,
    ]);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (subRes.data) setSubcategories(subRes.data as unknown as Subcategory[]);
    if (epRes?.data) setEpisode(epRes.data);
    setLoading(false);
  }

  const filteredUsers = useMemo(() =>
    profiles.filter(p => p.full_name.toLowerCase().includes(userSearch.toLowerCase())),
    [profiles, userSearch]
  );
  const selectedUser = useMemo(() => profiles.find(p => p.id === toUserId), [profiles, toUserId]);

  const positiveSubcats = useMemo(() => subcategories.filter(s => s.sentiment === 'positive'), [subcategories]);
  const negativeSubcats = useMemo(() => subcategories.filter(s => s.sentiment === 'negative'), [subcategories]);

  function toggleSub(id: string) {
    setSelectedSubs(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  const derivedSentiment = useMemo(() => {
    if (selectedSubs.length === 0) return 'positive';
    const posCount = selectedSubs.filter(id => subcategories.find(s => s.id === id)?.sentiment === 'positive').length;
    return posCount >= selectedSubs.length / 2 ? 'positive' : 'negative';
  }, [selectedSubs, subcategories]);

  const isValid = toUserId && selectedSubs.length >= 1 && selectedSubs.length <= 3 && comment.length >= 10 && comment.length <= 500;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const targetEpisodeId = episodeId || null;
      if (!targetEpisodeId) throw new Error('Не указан эпизод');

      // For embed, we insert into embed_responses with source='embed'
      // We also try to insert as regular feedback if possible
      const { error: err } = await supabase.from('embed_responses').insert({
        cycle_id: targetEpisodeId, // reuse field for episode reference
        template_id: targetEpisodeId, // placeholder
        answers_json: {
          type: 'feedback',
          to_user_id: toUserId,
          subcategory_ids: selectedSubs,
          sentiment: derivedSentiment,
          comment,
          episode_id: targetEpisodeId,
        },
        source: 'embed_feedback',
        respondent_email: null,
        metadata: { theme, origin: document.referrer },
      });
      if (err) throw err;
      setSubmitted(true);
      window.parent.postMessage({ type: 'mira-submitted' }, '*');
    } catch (e: any) {
      setError(e.message || 'Ошибка при отправке');
    }
    setSubmitting(false);
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";
  const cardCls = "rounded-xl border border-border bg-card p-5 shadow-sm";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-background text-foreground p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-6">
          <CheckCircle2 size={32} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold mb-2">Спасибо за отзыв!</h2>
        <p className="text-muted-foreground">Ваш отзыв был отправлен.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base tracking-wide">МИРА</span>
            <span className="text-xs text-muted-foreground">• отзыв по эпизоду</span>
          </div>
          {episode && (
            <p className="text-sm text-muted-foreground">{episode.title} — {episode.date}</p>
          )}
        </div>

        {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2"><AlertCircle size={16} />{error}</div>}

        {/* Recipient */}
        <div className={cardCls}>
          <h3 className="font-semibold mb-3">Кому</h3>
          {selectedUser ? (
            <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
              <span className="font-medium flex-1">{selectedUser.full_name}</span>
              <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => { setToUserId(''); setUserSearch(''); }}><X size={14} /></button>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input className={cn(inputCls, "pl-9")} value={userSearch} onChange={e => { setUserSearch(e.target.value); setDropdownOpen(true); }} onFocus={() => setDropdownOpen(true)} onBlur={() => setTimeout(() => setDropdownOpen(false), 200)} placeholder="Имя сотрудника..." />
              {dropdownOpen && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredUsers.length > 0 ? filteredUsers.map(u => (
                    <button key={u.id} type="button" className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors" onMouseDown={e => e.preventDefault()} onClick={() => { setToUserId(u.id); setUserSearch(''); setDropdownOpen(false); }}>{u.full_name}</button>
                  )) : <p className="text-sm text-muted-foreground p-3">Не найден</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Subcategories */}
        <div className={cardCls}>
          <h3 className="font-semibold mb-3">Подкатегории <span className="text-muted-foreground font-normal text-sm">(1–3)</span></h3>
          <div className="space-y-4">
            {positiveSubcats.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-positive mb-2 uppercase tracking-wide">Позитивные</p>
                <div className="flex flex-wrap gap-2">
                  {positiveSubcats.map(sub => {
                    const Icon = getSubcategoryIcon(sub.name);
                    const selected = selectedSubs.includes(sub.id);
                    const disabled = selectedSubs.length >= 3 && !selected;
                    return (
                      <button key={sub.id} type="button" onClick={() => !disabled && toggleSub(sub.id)}
                        className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                          selected ? "bg-positive/15 border-positive/40 text-positive" : "bg-card border-border hover:bg-positive/5",
                          disabled && "opacity-35 cursor-not-allowed"
                        )}>
                        <Icon size={15} />{sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {negativeSubcats.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-negative mb-2 uppercase tracking-wide">Негативные</p>
                <div className="flex flex-wrap gap-2">
                  {negativeSubcats.map(sub => {
                    const Icon = getSubcategoryIcon(sub.name);
                    const selected = selectedSubs.includes(sub.id);
                    const disabled = selectedSubs.length >= 3 && !selected;
                    return (
                      <button key={sub.id} type="button" onClick={() => !disabled && toggleSub(sub.id)}
                        className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                          selected ? "bg-negative/15 border-negative/40 text-negative" : "bg-card border-border hover:bg-negative/5",
                          disabled && "opacity-35 cursor-not-allowed"
                        )}>
                        <Icon size={15} />{sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comment */}
        <div className={cardCls}>
          <h3 className="font-semibold mb-3">Комментарий</h3>
          <textarea className={cn(inputCls, "resize-none")} rows={4} value={comment} onChange={e => setComment(e.target.value.slice(0, 500))} placeholder="Опишите ситуацию конкретно..." />
          <p className="text-xs text-muted-foreground mt-1">{comment.length}/500</p>
        </div>

        <button onClick={handleSubmit} disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Отправить отзыв
        </button>

        <div className="text-center text-xs text-muted-foreground">Отзыв на платформе МИРА</div>
      </div>
    </div>
  );
}
