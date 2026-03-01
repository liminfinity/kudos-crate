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
import { Heart, Award, TrendingUp } from 'lucide-react';
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
  'hsl(222, 35%, 20%)', 'hsl(160, 60%, 30%)', 'hsl(35, 45%, 48%)',
  'hsl(260, 25%, 50%)', 'hsl(4, 55%, 44%)', 'hsl(190, 50%, 40%)',
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
    return kudos.filter(k => profileMap[k.to_user_id]?.team_id === teamFilter);
  }, [kudos, teamFilter, profileMap]);

  const topReceivers = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.to_user_id] = (counts[k.to_user_id] || 0) + 1; });
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([uid, count]) => ({ name: profileMap[uid]?.full_name || uid, count, userId: uid }));
  }, [filtered, profileMap]);

  const avgKudos = useMemo(() => {
    if (profiles.length === 0) return 1;
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.to_user_id] = (counts[k.to_user_id] || 0) + 1; });
    const vals = Object.values(counts);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / profiles.length : 1;
  }, [filtered, profiles]);

  const topWithIndex = useMemo(() => topReceivers.map(r => ({
    ...r, helpIndex: avgKudos > 0 ? Number((r.count / avgKudos).toFixed(2)) : 0,
  })), [topReceivers, avgKudos]);

  const categoryDist = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(k => { counts[k.category] = (counts[k.category] || 0) + 1; });
    return Object.entries(counts).map(([cat, count]) => ({ name: CATEGORY_LABELS[cat] || cat, value: count }));
  }, [filtered]);

  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    filtered.forEach(k => { const m = format(parseISO(k.created_at), 'yyyy-MM'); months[m] = (months[m] || 0) + 1; });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
      .map(([m, count]) => ({ month: format(parseISO(m + '-01'), 'MMM yyyy', { locale: ru }), count }));
  }, [filtered]);

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
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold">Благодарности</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Аналитика признания и взаимопомощи</p>
        </div>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Период</Label>
                <Select value={period} onValueChange={v => setPeriod(v as PeriodPreset)}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3m">3 месяца</SelectItem>
                    <SelectItem value="6m">6 месяцев</SelectItem>
                    <SelectItem value="1y">Год</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Команда</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все команды</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/8"><Heart size={16} className="text-positive" /></div><div><p className="text-xl font-semibold">{filtered.length}</p><p className="text-[11px] text-muted-foreground">Благодарностей</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/8"><Award size={16} className="text-primary" /></div><div><p className="text-xl font-semibold truncate">{topReceivers[0]?.name || '—'}</p><p className="text-[11px] text-muted-foreground">Лидер</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4 pb-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/8"><TrendingUp size={16} className="text-primary" /></div><div><p className="text-xl font-semibold">{avgKudos.toFixed(1)}</p><p className="text-[11px] text-muted-foreground">Среднее на сотрудника</p></div></div></CardContent></Card>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>По месяцам</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" fill="hsl(var(--positive))" radius={[3, 3, 0, 0]} name="Благодарностей" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-xs text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>По категориям</CardTitle></CardHeader>
            <CardContent>
              {categoryDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categoryDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 9 }}>
                      {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-xs text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>
        </div>

        {teamData.length > 0 && (
          <Card>
            <CardHeader><CardTitle>По командам</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={teamData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} name="Благодарностей" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Топ получателей</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-5 px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Сотрудник</TableHead>
                  <TableHead className="text-center text-xs">Благодарностей</TableHead>
                  <TableHead className="text-center text-xs">Help Index</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topWithIndex.map((r, i) => (
                  <TableRow key={r.userId}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium text-xs">{r.name}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary" className="text-[10px] font-normal">{r.count}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Badge variant={r.helpIndex >= 1.5 ? 'default' : 'outline'}
                        className={r.helpIndex >= 1.5 ? 'bg-positive hover:bg-positive/90 text-[10px]' : 'text-[10px]'}>
                        {r.helpIndex}x
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {topWithIndex.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">Нет данных</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
