import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { Profile, Team } from '@/lib/supabase-types';
import { useAuth } from '@/contexts/AuthContext';

const WORK_CONDITIONS = [
  'Понимаю, что от меня ждут',
  'Хватает ресурсов для работы',
  'Понятна постановка задач',
  'Чувствую поддержку руководителя',
  'Атмосфера в команде',
  'Справедливость распределения нагрузки',
];

const LIKERT_OPTIONS = ['Полностью устраивает', 'Скорее да', 'Скорее нет', 'Не устраивает'];
const LIKERT_COLORS = ['hsl(152, 56%, 40%)', 'hsl(152, 40%, 55%)', 'hsl(35, 80%, 55%)', 'hsl(4, 76%, 56%)'];

const DIFFICULTIES = [
  'Размытые требования/цели',
  'Высокая нагрузка/переработки',
  'Зависимости от других (ждем ответов)',
  'Нехватка знаний/опыта',
  'Сложности в коммуникации',
];

const WELLBEING_OPTIONS = [
  'Стабильно, комфортно, чувствую опору',
  'Рабочее состояние, но бывают сложности',
  'Часто чувствую напряжение или усталость',
  'Близок к выгоранию / Мне тяжело',
];

const TEAM_ROLES = [
  'Идейный вдохновитель (генератор идей)',
  'Исполнитель (довожу задачи до конца)',
  'Координатор (организую людей и процессы)',
  'Эксперт/аналитик (люблю разбираться в деталях)',
  '«Маг» / Коммуникатор (поддерживаю связь, помогаю другим)',
  'Критик (замечаю риски и ошибки)',
];

export default function SurveyAnalytics() {
  const { role } = useAuth();
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycle, setSelectedCycle] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamFilter, setTeamFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCycles(); }, []);

  async function loadCycles() {
    const { data } = await supabase.from('survey_cycles').select(`
      id, label, period_start, period_end, status,
      template:survey_templates!inner(type)
    `).eq('template.type', 'half_year_employee' as any)
      .order('period_start', { ascending: false });
    if (data && data.length > 0) {
      setCycles(data);
      setSelectedCycle(data[0].id);
    }
    const [tRes, pRes] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('profiles').select('*'),
    ]);
    if (tRes.data) setTeams(tRes.data as unknown as Team[]);
    if (pRes.data) setProfiles(pRes.data as unknown as Profile[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!selectedCycle) return;
    loadCycleData();
  }, [selectedCycle]);

  async function loadCycleData() {
    const [aRes, rRes] = await Promise.all([
      supabase.from('survey_assignments').select('id, user_id, team_id, status, submitted_at')
        .eq('cycle_id', selectedCycle),
      supabase.from('survey_responses').select('id, assignment_id, answers_json')
        .in('assignment_id', (await supabase.from('survey_assignments').select('id').eq('cycle_id', selectedCycle)).data?.map(d => d.id) || []),
    ]);
    setAssignments(aRes.data || []);
    setResponses(rRes.data || []);
  }

  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  const filteredAssignments = useMemo(() => {
    if (teamFilter === 'all') return assignments;
    return assignments.filter(a => a.team_id === teamFilter);
  }, [assignments, teamFilter]);

  const filteredResponses = useMemo(() => {
    const ids = new Set(filteredAssignments.map(a => a.id));
    return responses.filter(r => ids.has(r.assignment_id));
  }, [filteredAssignments, responses]);

  const answersArray = useMemo(() => filteredResponses.map(r => r.answers_json as any).filter(Boolean), [filteredResponses]);

  // Completion stats
  const totalAssigned = filteredAssignments.length;
  const submittedCount = filteredAssignments.filter(a => a.status === 'submitted').length;
  const completionRate = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0;

  // Work conditions distribution
  const conditionsData = useMemo(() => {
    return WORK_CONDITIONS.map(cond => {
      const counts: Record<string, number> = {};
      LIKERT_OPTIONS.forEach(o => counts[o] = 0);
      answersArray.forEach(a => {
        const val = a.work_conditions?.[cond];
        if (val && counts[val] !== undefined) counts[val]++;
      });
      return { condition: cond, ...counts };
    });
  }, [answersArray]);

  // Top difficulties
  const difficultiesData = useMemo(() => {
    const counts: Record<string, number> = {};
    DIFFICULTIES.forEach(d => counts[d] = 0);
    answersArray.forEach(a => {
      (a.difficulties || []).forEach((d: string) => {
        if (counts[d] !== undefined) counts[d]++;
      });
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [answersArray]);

  // Wellbeing distribution
  const wellbeingData = useMemo(() => {
    const counts: Record<string, number> = {};
    WELLBEING_OPTIONS.forEach(o => counts[o] = 0);
    answersArray.forEach(a => { if (a.wellbeing && counts[a.wellbeing] !== undefined) counts[a.wellbeing]++; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [answersArray]);

  // Team roles distribution
  const rolesData = useMemo(() => {
    const counts: Record<string, number> = {};
    TEAM_ROLES.forEach(r => counts[r] = 0);
    answersArray.forEach(a => {
      (a.team_roles || []).forEach((r: string) => { if (counts[r] !== undefined) counts[r]++; });
    });
    return Object.entries(counts).map(([name, count]) => ({ name: name.split('(')[0].trim(), count })).sort((a, b) => b.count - a.count);
  }, [answersArray]);

  // Sociometry graph
  const sociometryData = useMemo(() => {
    const mentions: Record<string, number> = {};
    answersArray.forEach(a => {
      (a.sociometry_interact || []).forEach((uid: string) => {
        mentions[uid] = (mentions[uid] || 0) + 1;
      });
    });
    return Object.entries(mentions)
      .map(([userId, count]) => ({ userId, name: profileMap[userId]?.full_name || userId, count }))
      .sort((a, b) => b.count - a.count);
  }, [answersArray, profileMap]);

  function exportCSV() {
    const header = 'Сотрудник,Команда,Статус,Основная работа,Достижение,Состояние,Вовлечённость';
    const rows = filteredAssignments.map(a => {
      const resp = responses.find(r => r.assignment_id === a.id);
      const ans = resp?.answers_json as any || {};
      const p = profileMap[a.user_id];
      const team = teams.find(t => t.id === a.team_id)?.name || '';
      return [
        `"${p?.full_name || ''}"`, `"${team}"`, a.status,
        `"${(ans.main_work || '').replace(/"/g, '""').slice(0, 100)}"`,
        `"${(ans.main_achievement || '').replace(/"/g, '""').slice(0, 100)}"`,
        `"${ans.wellbeing || ''}"`, `"${ans.involvement || ''}"`,
      ].join(',');
    });
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'survey_export.csv'; a.click();
  }

  const PIE_COLORS = ['hsl(152, 56%, 40%)', 'hsl(35, 80%, 55%)', 'hsl(4, 60%, 55%)', 'hsl(4, 76%, 45%)'];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Аналитика: Полугодовой срез</h1>
            <p className="text-muted-foreground">Агрегированные результаты опроса</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1"><Download size={14} /> CSV</Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Цикл</Label>
                <Select value={selectedCycle} onValueChange={setSelectedCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Команда</Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Users size={18} className="text-primary" /></div>
              <div><p className="text-2xl font-bold">{totalAssigned}</p><p className="text-xs text-muted-foreground">Назначено</p></div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/10"><CheckCircle2 size={18} className="text-positive" /></div>
              <div><p className="text-2xl font-bold">{submittedCount}</p><p className="text-xs text-muted-foreground">Отправлено</p></div>
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-accent"><Clock size={18} className="text-muted-foreground" /></div>
              <div><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Заполняемость</p></div>
            </div>
          </CardContent></Card>
        </div>

        {/* Work conditions stacked bar */}
        <Card>
          <CardHeader><CardTitle className="text-base">Оценка условий работы</CardTitle></CardHeader>
          <CardContent>
            {conditionsData.length > 0 && answersArray.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conditionsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis dataKey="condition" type="category" width={200} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {LIKERT_OPTIONS.map((opt, i) => (
                    <Bar key={opt} dataKey={opt} stackId="a" fill={LIKERT_COLORS[i]} name={opt} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
          </CardContent>
        </Card>

        {/* Difficulties bar */}
        <Card>
          <CardHeader><CardTitle className="text-base">Топ сложностей</CardTitle></CardHeader>
          <CardContent>
            {difficultiesData.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={difficultiesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={220} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} name="Кол-во" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Wellbeing pie */}
          <Card>
            <CardHeader><CardTitle className="text-base">Самочувствие</CardTitle></CardHeader>
            <CardContent>
              {wellbeingData.some(d => d.value > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={wellbeingData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {wellbeingData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
            </CardContent>
          </Card>

          {/* Team roles */}
          <Card>
            <CardHeader><CardTitle className="text-base">Роли в команде (самооценка)</CardTitle></CardHeader>
            <CardContent>
              {rolesData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={rolesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="Кол-во" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
            </CardContent>
          </Card>
        </div>

        {/* Sociometry top mentions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Социометрия: частота упоминаний</CardTitle></CardHeader>
          <CardContent>
            {sociometryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(200, sociometryData.length * 35)}>
                <BarChart data={sociometryData.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} name="Упоминаний" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
          </CardContent>
        </Card>

        {/* Raw responses table (HR/Admin only) */}
        {(role === 'hr' || role === 'admin') && (
          <Card>
            <CardHeader><CardTitle className="text-base">Ответы (сырые данные)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Команда</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Состояние</TableHead>
                    <TableHead>Вовлечённость</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => {
                    const resp = responses.find(r => r.assignment_id === a.id);
                    const ans = resp?.answers_json as any || {};
                    const p = profileMap[a.user_id];
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{p?.full_name || '—'}</TableCell>
                        <TableCell>{teams.find(t => t.id === a.team_id)?.name || '—'}</TableCell>
                        <TableCell><Badge variant={a.status === 'submitted' ? 'default' : 'secondary'} className="text-xs">{a.status}</Badge></TableCell>
                        <TableCell className="text-sm">{ans.wellbeing?.split(',')[0]?.slice(0, 30) || '—'}</TableCell>
                        <TableCell className="text-sm">{ans.involvement?.split(',')[0]?.slice(0, 30) || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
