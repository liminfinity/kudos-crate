import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle, Download, Shield } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Profile, Team } from '@/lib/supabase-types';

type PeriodPreset = '3m' | '6m' | '1y';

export default function CriticalIncidents() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [incidents, setIncidents] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [subcatMap, setSubcatMap] = useState<Record<string, string>>({});
  const [feedbackSubs, setFeedbackSubs] = useState<any[]>([]);
  const [criticalSubcats, setCriticalSubcats] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    const startDate = subMonths(new Date(), period === '3m' ? 3 : period === '6m' ? 6 : 12).toISOString();
    const [fbRes, profRes, teamRes, subRes, fsRes] = await Promise.all([
      supabase.from('feedback').select('*').eq('is_critical', true).gte('created_at', startDate),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('subcategories').select('*').eq('is_critical', true),
      supabase.from('feedback_subcategories').select('*'),
    ]);
    if (fbRes.data) setIncidents(fbRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
    if (subRes.data) {
      setCriticalSubcats(subRes.data);
      const map: Record<string, string> = {};
      subRes.data.forEach((s: any) => { map[s.id] = s.name; });
      setSubcatMap(map);
    }
    if (fsRes.data) setFeedbackSubs(fsRes.data);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  // Map feedback to subcategories
  const fbSubMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    feedbackSubs.forEach(fs => {
      if (!m[fs.feedback_id]) m[fs.feedback_id] = [];
      if (subcatMap[fs.subcategory_id]) m[fs.feedback_id].push(subcatMap[fs.subcategory_id]);
    });
    return m;
  }, [feedbackSubs, subcatMap]);

  const filtered = useMemo(() => {
    return incidents.filter(f => {
      if (teamFilter !== 'all') {
        const prof = profileMap[f.to_user_id];
        if (!prof || prof.team_id !== teamFilter) return false;
      }
      if (employeeFilter !== 'all' && f.to_user_id !== employeeFilter) return false;
      if (categoryFilter !== 'all') {
        const subs = fbSubMap[f.id] || [];
        if (!subs.some(s => s === categoryFilter)) return false;
      }
      return true;
    });
  }, [incidents, teamFilter, employeeFilter, categoryFilter, profileMap, fbSubMap]);

  // Monthly chart
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    filtered.forEach(f => {
      const m = format(parseISO(f.created_at), 'yyyy-MM');
      months[m] = (months[m] || 0) + 1;
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b))
      .map(([m, count]) => ({ month: format(parseISO(m + '-01'), 'MMM yyyy', { locale: ru }), count }));
  }, [filtered]);

  // Team distribution
  const teamDist = useMemo(() => {
    const data: Record<string, { name: string; count: number }> = {};
    filtered.forEach(f => {
      const prof = profileMap[f.to_user_id];
      const teamId = prof?.team_id || 'unknown';
      const teamName = teams.find(t => t.id === teamId)?.name || 'Без команды';
      if (!data[teamId]) data[teamId] = { name: teamName, count: 0 };
      data[teamId].count++;
    });
    return Object.values(data).sort((a, b) => b.count - a.count);
  }, [filtered, profileMap, teams]);

  // Repeat offenders
  const repeatData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(f => { counts[f.to_user_id] = (counts[f.to_user_id] || 0) + 1; });
    return Object.entries(counts)
      .filter(([, c]) => c > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([uid, count]) => ({ name: profileMap[uid]?.full_name || uid, count }));
  }, [filtered, profileMap]);

  function exportCSV() {
    const header = 'Дата,Получатель,Команда,Категории,Комментарий';
    const rows = filtered.map(f => {
      const prof = profileMap[f.to_user_id];
      const team = prof?.team_id ? teams.find(t => t.id === prof.team_id)?.name || '' : '';
      const cats = (fbSubMap[f.id] || []).join('; ');
      return [format(parseISO(f.created_at), 'yyyy-MM-dd'), `"${prof?.full_name || ''}"`, `"${team}"`, `"${cats}"`, `"${f.comment.replace(/"/g, '""')}"`].join(',');
    });
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'critical_incidents.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (role !== 'hr' && role !== 'admin') {
    return <AppLayout><div className="text-center py-20 text-muted-foreground">Доступ ограничен</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle size={20} className="text-destructive" /></div>
            <div>
              <h1 className="text-2xl font-bold">Серьёзные сигналы</h1>
              <p className="text-muted-foreground">Отслеживание значимых инцидентов (HR/Admin)</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1"><Download size={14} /> Экспорт CSV</Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
              <div>
                <Label className="text-xs text-muted-foreground">Сотрудник</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Категория</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {criticalSubcats.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5"><p className="text-2xl font-bold text-destructive">{filtered.length}</p><p className="text-xs text-muted-foreground">Инцидентов за период</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-2xl font-bold">{repeatData.length}</p><p className="text-xs text-muted-foreground">Повторные нарушители</p></CardContent></Card>
          <Card><CardContent className="pt-5"><p className="text-2xl font-bold">{teamDist.length}</p><p className="text-xs text-muted-foreground">Команд затронуто</p></CardContent></Card>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Инциденты по месяцам</CardTitle></CardHeader>
            <CardContent>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Инцидентов" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">По командам</CardTitle></CardHeader>
            <CardContent>
              {teamDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={teamDist} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name="Инцидентов" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
            </CardContent>
          </Card>
        </div>

        {/* Repeat offenders */}
        {repeatData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Повторные нарушения</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead className="text-center">Количество</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repeatData.map(r => (
                    <TableRow key={r.name}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-center"><Badge variant="destructive">{r.count}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Details table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Детали инцидентов</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Получатель</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Категории</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(f => {
                  const prof = profileMap[f.to_user_id];
                  const team = prof?.team_id ? teams.find(t => t.id === prof.team_id)?.name : '';
                  const cats = fbSubMap[f.id] || [];
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="whitespace-nowrap">{format(parseISO(f.created_at), 'dd.MM.yyyy')}</TableCell>
                      <TableCell>{prof?.full_name || '—'}</TableCell>
                      <TableCell>{team || '—'}</TableCell>
                      <TableCell><div className="flex gap-1 flex-wrap">{cats.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}</div></TableCell>
                      <TableCell className="max-w-xs truncate">{f.comment}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет инцидентов</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
