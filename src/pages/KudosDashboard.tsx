import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Heart, Award, TrendingUp, Info } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Profile, Team } from '@/lib/supabase-types';

type PeriodPreset = '3m' | '6m' | '1y';

const CATEGORY_LABELS: Record<string, string> = {
  helped_understand: 'Помог разобраться',
  emotional_support: 'Поддержка',
  saved_deadline: 'Спас дедлайн',
  shared_expertise: 'Экспертиза',
  mentoring: 'Наставничество',
  team_support: 'Командная поддержка',
};

const PIE_COLORS = [
  'hsl(230, 65%, 48%)', 'hsl(152, 56%, 40%)', 'hsl(35, 92%, 50%)',
  'hsl(280, 60%, 50%)', 'hsl(4, 76%, 56%)', 'hsl(190, 70%, 45%)',
];

export default function KudosDashboard() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [kudos, setKudos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    const startDate = subMonths(new Date(), period === '3m' ? 3 : period === '6m' ? 6 : 12).toISOString();
    const [kRes, profRes, teamRes] = await Promise.all([
      supabase.from('kudos').select('*').gte('created_at', startDate),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
    ]);
    if (kRes.data) setKudos(kRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    if (teamFilter === 'all') return kudos;
    return kudos.filter(k => {
      const prof = profileMap[k.to_user_id];
      return prof?.team_id === teamFilter;
    });
  }, [kudos, teamFilter, profileMap]);

  // Top receivers
  const topReceivers = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.to_user_id] = (counts[k.to_user_id] || 0) + 1; });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uid, count]) => ({ name: profileMap[uid]?.full_name || uid, count, userId: uid }));
  }, [filtered, profileMap]);

  // Help Index
  const avgKudos = useMemo(() => {
    if (profiles.length === 0) return 1;
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.to_user_id] = (counts[k.to_user_id] || 0) + 1; });
    const vals = Object.values(counts);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / profiles.length : 1;
  }, [filtered, profiles]);

  const topWithIndex = useMemo(() => {
    return topReceivers.map(r => ({
      ...r,
      helpIndex: avgKudos > 0 ? Number((r.count / avgKudos).toFixed(2)) : 0,
    }));
  }, [topReceivers, avgKudos]);

  // Category distribution
  const categoryDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.category] = (counts[k.category] || 0) + 1; });
    return Object.entries(counts).map(([cat, count]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value: count,
    }));
  }, [filtered]);

  // Monthly timeline
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    filtered.forEach(k => {
      const m = format(parseISO(k.created_at), 'yyyy-MM');
      months[m] = (months[m] || 0) + 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
      .map(([m, count]) => ({ month: format(parseISO(m + '-01'), 'MMM yyyy', { locale: ru }), count }));
  }, [filtered]);

  // Team breakdown
  const teamData = useMemo(() => {
    const data: Record<string, { name: string; count: number }> = {};
    filtered.forEach(k => {
      const prof = profileMap[k.to_user_id];
      const teamId = prof?.team_id || 'unknown';
      const teamName = teams.find(t => t.id === teamId)?.name || 'Без команды';
      if (!data[teamId]) data[teamId] = { name: teamName, count: 0 };
      data[teamId].count++;
    });
    return Object.values(data).sort((a, b) => b.count - a.count);
  }, [filtered, profileMap, teams]);

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Heart size={24} className="text-positive" />
          <div>
            <h1 className="text-2xl font-bold">Благодарности</h1>
            <p className="text-muted-foreground">Аналитика признания и взаимопомощи в команде</p>
          </div>
        </div>

        {/* Kudos explanation */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <Info size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Что такое Kudos?</p>
            <p>Kudos — это короткая благодарность коллеге за помощь, поддержку или вклад в работу. Используйте kudos, чтобы отмечать позитивные действия и усиливать культуру взаимопомощи. Лимит: 5 kudos в месяц, не чаще 1 раза в 7 дней одному получателю.</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Период</Label>
                <Select value={period} onValueChange={v => setPeriod(v as PeriodPreset)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3m">3 месяца</SelectItem>
                    <SelectItem value="6m">6 месяцев</SelectItem>
                    <SelectItem value="1y">Год</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Команда</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все команды</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/10"><Heart size={18} className="text-positive" /></div><div><p className="text-2xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Kudos за период</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Award size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{topReceivers[0]?.name || '—'}</p><p className="text-xs text-muted-foreground">Лидер по kudos</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><TrendingUp size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{avgKudos.toFixed(1)}</p><p className="text-xs text-muted-foreground">Среднее на сотрудника</p></div></div></CardContent></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Monthly timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Kudos по месяцам</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--positive))" radius={[4, 4, 0, 0]} name="Kudos" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>

          {/* Category pie */}
          <Card>
            <CardHeader><CardTitle className="text-base">По категориям</CardTitle></CardHeader>
            <CardContent>
              {categoryDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>
        </div>

        {/* Team breakdown */}
        {teamData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Kudos по командам</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={teamData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Kudos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top receivers with Help Index */}
        <Card>
          <CardHeader><CardTitle className="text-base">Топ получателей kudos + Help Index</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead className="text-center">Kudos</TableHead>
                  <TableHead className="text-center">Help Index</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topWithIndex.map((r, i) => (
                  <TableRow key={r.userId}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary">{r.count}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.helpIndex >= 1.5 ? 'default' : 'outline'}
                        className={r.helpIndex >= 1.5 ? 'bg-positive hover:bg-positive/90' : ''}>
                        {r.helpIndex}x
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {topWithIndex.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Нет данных</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
