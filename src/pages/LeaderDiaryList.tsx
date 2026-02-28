import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Team, Profile } from '@/lib/supabase-types';

const statusLabels: Record<string, string> = {
  not_started: 'Не начат', in_progress: 'В процессе', submitted: 'Отправлен', overdue: 'Просрочен',
};

export default function LeaderDiaryList() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teamFilter, setTeamFilter] = useState('all');
  const isAdmin = role === 'admin' || role === 'hr';

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [aRes, tRes, pRes] = await Promise.all([
      supabase.from('survey_assignments').select(`
        id, cycle_id, user_id, status, team_id, submitted_at, created_at,
        cycle:survey_cycles!inner(label, period_start, period_end, due_date,
          template:survey_templates!inner(name, type))
      `).eq('cycle.template.type', 'bi_month_manager' as any)
        .order('created_at', { ascending: false }),
      supabase.from('teams').select('*'),
      supabase.from('profiles').select('*'),
    ]);

    let data = (aRes.data || []) as any[];
    // Non-admin managers see only their own
    if (!isAdmin) {
      data = data.filter((d: any) => d.user_id === user?.id);
    }
    setAssignments(data);
    if (tRes.data) setTeams(tRes.data as unknown as Team[]);
    if (pRes.data) setProfiles(pRes.data as unknown as Profile[]);
    setLoading(false);
  }

  const filtered = teamFilter === 'all' ? assignments : assignments.filter((a: any) => a.team_id === teamFilter);
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]));

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Дневник руководителя</h1>
        <p className="text-muted-foreground mb-6">
          {isAdmin ? 'Просмотр дневников всех руководителей' : 'Ваши дневники по периодам'}
        </p>

        {isAdmin && (
          <div className="mb-4">
            <Label className="text-xs text-muted-foreground">Команда</Label>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все команды</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет дневников</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((a: any) => (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <BookOpen size={16} className="text-primary" />
                        <h3 className="font-semibold">{a.cycle.label}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {profileMap[a.user_id]?.full_name || 'Руководитель'} •
                        {a.cycle.period_start} — {a.cycle.period_end}
                      </p>
                      <Badge variant={a.status === 'submitted' ? 'default' : 'secondary'} className="text-xs mt-2">
                        {statusLabels[a.status]}
                      </Badge>
                    </div>
                    <Button size="sm" variant={a.status === 'submitted' ? 'outline' : 'default'}
                      onClick={() => navigate(`/leader-diary/${a.id}`)}>
                      {a.status === 'submitted' ? 'Просмотр' : a.user_id === user?.id ? 'Заполнить' : 'Просмотр'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
