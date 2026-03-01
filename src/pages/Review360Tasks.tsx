import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, CheckCircle2, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Profile } from '@/lib/supabase-types';

export default function Review360Tasks() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    const [asgRes, cycRes, profRes] = await Promise.all([
      supabase.from('review_360_assignments' as any).select('*').eq('reviewer_user_id', user!.id),
      supabase.from('review_360_cycles' as any).select('*').in('status', ['published', 'closed']),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    if (asgRes.data) setAssignments(asgRes.data);
    if (cycRes.data) setCycles(cycRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    setLoading(false);
  }

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.id, p])), [profiles]);
  const cycleMap = useMemo(() => new Map(cycles.map(c => [c.id, c])), [cycles]);

  // Group by cycle
  const groupedByCycle = useMemo(() => {
    const map = new Map<string, any[]>();
    assignments.forEach(a => {
      const list = map.get(a.cycle_id) || [];
      list.push(a);
      map.set(a.cycle_id, list);
    });
    return map;
  }, [assignments]);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">Мои задания 360</h1>
        </div>
        <p className="text-muted-foreground mb-6">Заполните отзывы о назначенных коллегах</p>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : assignments.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">У вас пока нет назначений на ревью 360</CardContent></Card>
        ) : (
          <div className="space-y-6">
            {[...groupedByCycle.entries()].map(([cycleId, asgList]) => {
              const cycle = cycleMap.get(cycleId);
              const done = asgList.filter(a => a.status === 'submitted').length;
              const total = asgList.length;
              const progress = total > 0 ? (done / total) * 100 : 0;

              return (
                <Card key={cycleId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{cycle?.title || 'Цикл 360'}</CardTitle>
                      <Badge variant={done === total ? 'default' : 'secondary'}>{done}/{total}</Badge>
                    </div>
                    <Progress value={progress} className="h-2 mt-2" />
                    {cycle && (
                      <p className="text-xs text-muted-foreground mt-1">Дедлайн: {new Date(cycle.due_date).toLocaleDateString()}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {asgList.map(a => {
                      const reviewee = profileMap.get(a.reviewee_user_id);
                      const isSubmitted = a.status === 'submitted';
                      return (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                          <div className="flex items-center gap-3">
                            {isSubmitted ? (
                              <CheckCircle2 size={18} className="text-positive" />
                            ) : (
                              <Clock size={18} className="text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">{reviewee?.full_name || '—'}</span>
                          </div>
                          {!isSubmitted ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/review-360/fill/${a.id}`}>
                                Заполнить <ChevronRight size={14} />
                              </Link>
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-positive border-positive/30">Готово</Badge>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
