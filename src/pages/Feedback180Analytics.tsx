import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Users, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import type { Profile } from '@/lib/supabase-types';

export default function Feedback180Analytics() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [revRes, profRes] = await Promise.all([
      supabase.from('feedback_180' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (revRes.data) setReviews(revRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    setLoading(false);
  }

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);

  const filteredReviews = useMemo(() =>
    selectedUserId === 'all' ? reviews : reviews.filter(r => r.to_user_id === selectedUserId),
    [reviews, selectedUserId]
  );

  const usersWithReviews = useMemo(() => {
    const ids = new Set(reviews.map(r => r.to_user_id));
    return profiles.filter(p => ids.has(p.id));
  }, [reviews, profiles]);

  // Aggregate strengths/weaknesses
  const aggregated = useMemo(() => {
    const strengthsMap = new Map<string, number>();
    const weaknessesMap = new Map<string, number>();
    let totalScore = 0;
    let scoreCount = 0;

    filteredReviews.forEach(r => {
      (r.strengths || []).forEach((s: string) => strengthsMap.set(s, (strengthsMap.get(s) || 0) + 1));
      (r.weaknesses || []).forEach((w: string) => weaknessesMap.set(w, (weaknessesMap.get(w) || 0) + 1));
      if (r.collaboration_score) { totalScore += r.collaboration_score; scoreCount++; }
    });

    const topStrengths = [...strengthsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topWeaknesses = [...weaknessesMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const avgScore = scoreCount > 0 ? (totalScore / scoreCount).toFixed(1) : '—';

    return { topStrengths, topWeaknesses, avgScore, count: filteredReviews.length };
  }, [filteredReviews]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Отзывы 180 — Аналитика</h1>
        <p className="text-muted-foreground mb-6">Общие характеристики сотрудников (анонимные)</p>

        <div className="mb-6">
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Все сотрудники" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сотрудники</SelectItem>
              {usersWithReviews.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : filteredReviews.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет отзывов 180</CardContent></Card>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <FileText size={24} className="mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{aggregated.count}</p>
                  <p className="text-sm text-muted-foreground">Всего отзывов</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Star size={24} className="mx-auto mb-2 text-primary fill-primary" />
                  <p className="text-3xl font-bold">{aggregated.avgScore}</p>
                  <p className="text-sm text-muted-foreground">Средняя оценка</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users size={24} className="mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{usersWithReviews.length}</p>
                  <p className="text-sm text-muted-foreground">Сотрудников с отзывами</p>
                </CardContent>
              </Card>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingUp size={16} className="text-positive" /> Топ сильных сторон</CardTitle></CardHeader>
                <CardContent>
                  {aggregated.topStrengths.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm">{name}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><TrendingDown size={16} className="text-negative" /> Топ зон роста</CardTitle></CardHeader>
                <CardContent>
                  {aggregated.topWeaknesses.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm">{name}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Review texts (anonymous) */}
            <Card>
              <CardHeader><CardTitle className="text-base">Тексты отзывов</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {filteredReviews.map(r => (
                  <div key={r.id} className="p-4 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <span>О: <strong className="text-foreground">{profileMap.get(r.to_user_id)?.full_name || '—'}</strong></span>
                      <span>•</span>
                      <span>{r.period}</span>
                      {r.collaboration_score && (
                        <span className="flex items-center gap-0.5">
                          • {Array.from({ length: r.collaboration_score }).map((_, i) => <Star key={i} size={12} className="text-primary fill-primary" />)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.text_long}</p>
                    {(r.strengths?.length > 0 || r.weaknesses?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {r.strengths?.map((s: string) => <Badge key={s} className="bg-positive/10 text-positive border-positive/20">{s}</Badge>)}
                        {r.weaknesses?.map((w: string) => <Badge key={w} className="bg-negative/10 text-negative border-negative/20">{w}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
