import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, CheckCircle2, Clock, Star, BarChart3 } from 'lucide-react';
import type { Profile } from '@/lib/supabase-types';

export default function Review360Analytics() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [cycle, setCycle] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [cycleId]);

  async function loadData() {
    if (!cycleId) return;
    const [cycRes, asgRes, profRes] = await Promise.all([
      supabase.from('review_360_cycles' as any).select('*').eq('id', cycleId).single(),
      supabase.from('review_360_assignments' as any).select('*').eq('cycle_id', cycleId),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    if (cycRes.data) setCycle(cycRes.data);
    if (asgRes.data) {
      setAssignments(asgRes.data);
      // Load responses for these assignments
      const asgIds = asgRes.data.map((a: any) => a.id);
      if (asgIds.length > 0) {
        const { data: resData } = await supabase.from('review_360_responses' as any)
          .select('*').in('assignment_id', asgIds);
        if (resData) setResponses(resData);
      }
    }
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    setLoading(false);
  }

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const responseMap = useMemo(() => new Map(responses.map(r => [r.assignment_id, r])), [responses]);

  // Unique reviewees
  const reviewees = useMemo(() => {
    const ids = [...new Set(assignments.map(a => a.reviewee_user_id))];
    return ids.map(id => profileMap.get(id)).filter(Boolean) as Profile[];
  }, [assignments, profileMap]);

  // Completion stats
  const stats = useMemo(() => {
    const total = assignments.length;
    const submitted = assignments.filter(a => a.status === 'submitted').length;
    return { total, submitted, rate: total > 0 ? Math.round((submitted / total) * 100) : 0 };
  }, [assignments]);

  // Per-reviewee data
  const perReviewee = useMemo(() => {
    const filtered = selectedUserId === 'all' ? assignments : assignments.filter(a => a.reviewee_user_id === selectedUserId);
    const revieweeIds = [...new Set(filtered.map(a => a.reviewee_user_id))];

    return revieweeIds.map(uid => {
      const userAsg = filtered.filter(a => a.reviewee_user_id === uid);
      const userResponses = userAsg.map(a => responseMap.get(a.id)).filter(Boolean);
      const done = userAsg.filter(a => a.status === 'submitted').length;

      // Aggregate scores
      const scoreAgg: Record<string, number[]> = {};
      userResponses.forEach(r => {
        const scores = r.answers_json?.scores || {};
        Object.entries(scores).forEach(([k, v]) => {
          if (!scoreAgg[k]) scoreAgg[k] = [];
          scoreAgg[k].push(v as number);
        });
      });
      const avgScores = Object.fromEntries(
        Object.entries(scoreAgg).map(([k, vals]) => [k, (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)])
      );

      return {
        userId: uid,
        name: profileMap.get(uid)?.full_name || '—',
        total: userAsg.length,
        done,
        avgScores,
        texts: userResponses.map(r => ({
          strengths: r.answers_json?.strengths || '',
          improvements: r.answers_json?.improvements || '',
        })),
      };
    });
  }, [assignments, responses, selectedUserId, profileMap, responseMap]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Аналитика 360{cycle ? `: ${cycle.title}` : ''}</h1>
        <p className="text-muted-foreground mb-6">Результаты ревью (анонимные)</p>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : (
          <div className="space-y-6">
            {/* Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users size={24} className="mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{reviewees.length}</p>
                  <p className="text-sm text-muted-foreground">Сотрудников</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <CheckCircle2 size={24} className="mx-auto mb-2 text-positive" />
                  <p className="text-3xl font-bold">{stats.submitted}/{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Отзывов сдано</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <BarChart3 size={24} className="mx-auto mb-2 text-primary" />
                  <p className="text-3xl font-bold">{stats.rate}%</p>
                  <p className="text-sm text-muted-foreground">Completion rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Filter */}
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Все сотрудники" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {reviewees.map(u => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Per reviewee */}
            {perReviewee.map(item => (
              <Card key={item.userId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{item.name}</CardTitle>
                    <Badge variant={item.done >= (cycle?.required_reviews_per_user || 3) ? 'default' : 'secondary'}>
                      {item.done}/{item.total} отзывов
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Scores */}
                  {Object.keys(item.avgScores).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(item.avgScores).map(([key, avg]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/30 text-center">
                          <p className="text-xs text-muted-foreground capitalize">{key.replace('_', ' ')}</p>
                          <p className="text-lg font-bold flex items-center justify-center gap-1">
                            <Star size={14} className="text-primary fill-primary" />{avg}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Texts */}
                  {item.texts.filter(t => t.strengths || t.improvements).map((t, i) => (
                    <div key={i} className="p-3 rounded-lg border bg-muted/10 text-sm">
                      {t.strengths && <p><strong className="text-positive">Сильные:</strong> {t.strengths}</p>}
                      {t.improvements && <p className="mt-1"><strong className="text-negative">Улучшить:</strong> {t.improvements}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
