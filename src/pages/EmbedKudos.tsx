import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, AlertCircle, Search, X, Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

const KUDOS_CATEGORIES = [
  { value: 'helped_understand', label: 'Помог разобраться', emoji: '🧠' },
  { value: 'emotional_support', label: 'Поддержал', emoji: '💛' },
  { value: 'saved_deadline', label: 'Спас дедлайн', emoji: '⏰' },
  { value: 'shared_expertise', label: 'Экспертиза', emoji: '📚' },
  { value: 'mentoring', label: 'Наставничество', emoji: '🌱' },
  { value: 'team_support', label: 'Командная поддержка', emoji: '🤝' },
];

export default function EmbedKudos() {
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') || 'light';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [category, setCategory] = useState('');
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
    const { data } = await supabase.from('profiles').select('*').eq('is_active', true).order('full_name');
    if (data) setProfiles(data as unknown as Profile[]);
    setLoading(false);
  }

  const filteredUsers = useMemo(() =>
    profiles.filter(p => p.full_name.toLowerCase().includes(userSearch.toLowerCase())),
    [profiles, userSearch]
  );
  const selectedUser = useMemo(() => profiles.find(p => p.id === toUserId), [profiles, toUserId]);

  const isValid = toUserId && category;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase.from('embed_responses').insert({
        cycle_id: crypto.randomUUID(), // placeholder
        template_id: crypto.randomUUID(), // placeholder
        answers_json: {
          type: 'kudos',
          to_user_id: toUserId,
          category,
          comment: comment || null,
        },
        source: 'embed_kudos',
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
          <Heart size={32} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold mb-2">Kudos отправлен! 🎉</h2>
        <p className="text-muted-foreground">Благодарность делает команду сильнее.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 font-sans" style={{ fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-base tracking-wide">МИРА</span>
            <span className="text-xs text-muted-foreground">• благодарность</span>
          </div>
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

        {/* Category */}
        <div className={cardCls}>
          <h3 className="font-semibold mb-3">За что благодарите?</h3>
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
        </div>

        {/* Comment */}
        <div className={cardCls}>
          <h3 className="font-semibold mb-3">Комментарий <span className="text-muted-foreground font-normal">(необязательно)</span></h3>
          <textarea className={cn(inputCls, "resize-none")} rows={3} value={comment} onChange={e => setComment(e.target.value.slice(0, 300))} placeholder="Расскажите подробнее..." />
          <p className="text-xs text-muted-foreground mt-1">{comment.length}/300</p>
        </div>

        <button onClick={handleSubmit} disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
          💜 Отправить Kudos
        </button>

        <div className="text-center text-xs text-muted-foreground">Благодарность на платформе МИРА</div>
      </div>
    </div>
  );
}
