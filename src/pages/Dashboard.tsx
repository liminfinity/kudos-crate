import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart as RBarChart } from 'recharts';
import { Download, TrendingUp, TrendingDown, MessageSquare, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, Team } from '@/lib/supabase-types';
import { RelationshipGraph } from '@/components/RelationshipGraph';
import { InteractionHeatmap } from '@/components/InteractionHeatmap';
import { ConflictMatrix } from '@/components/ConflictMatrix';
import { EmployeeBarChart } from '@/components/EmployeeBarChart';
import { SentimentTimeline } from '@/components/SentimentTimeline';
import { subDays, subMonths, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

type PeriodPreset = '7d' | '30d' | '3m' | '6m' | '1y';

const periodLabels: Record<PeriodPreset, string> = {
  '7d': '7 дней', '30d': '30 дней', '3m': '3 месяца', '6m': '6 месяцев', '1y': 'Год',
};

function getPeriodStart(preset: PeriodPreset): Date {
  const now = new Date();
  switch (preset) {
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '3m': return subMonths(now, 3);
    case '6m': return subMonths(now, 6);
    case '1y': return subMonths(now, 12);
  }
}

interface FeedbackRow {
  id: string; sentiment: string; comment: string; created_at: string;
  from_user_id: string; to_user_id: string; episode_id: string;
}

interface SubcategoryRow { subcategory_id: string; feedback_id: string; }

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [showComments, setShowComments] = useState(false);

  const [feedbackData, setFeedbackData] = useState<FeedbackRow[]>([]);
  const [feedbackSubs, setFeedbackSubs] = useState<SubcategoryRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [subcatMap, setSubcatMap] = useState<Record<string, { name: string; sentiment: string }>>({});
  const [episodes, setEpisodes] = useState<Record<string, string>>({});

  useEffect(() => { loadAll(); }, [period]);

  async function loadAll() {
    const startDate = getPeriodStart(period).toISOString();
    const [fbRes, fsRes, profRes, teamRes, subRes, epRes] = await Promise.all([
      supabase.from('feedback').select('id, sentiment, comment, created_at, from_user_id, to_user_id, episode_id').gte('created_at', startDate),
      supabase.from('feedback_subcategories').select('feedback_id, subcategory_id'),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('subcategories').select('*'),
      supabase.from('work_episodes').select('id, title'),
    ]);
    if (fbRes.data) setFeedbackData(fbRes.data as unknown as FeedbackRow[]);
    if (fsRes.data) setFeedbackSubs(fsRes.data as unknown as SubcategoryRow[]);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
    if (subRes.data) {
      const map: Record<string, { name: string; sentiment: string }> = {};
      (subRes.data as any[]).forEach(s => { map[s.id] = { name: s.name, sentiment: s.sentiment }; });
      setSubcatMap(map);
    }
    if (epRes.data) {
      const map: Record<string, string> = {};
      (epRes.data as any[]).forEach(e => { map[e.id] = e.title; });
      setEpisodes(map);
    }
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    return feedbackData.filter(f => {
      if (sentimentFilter !== 'all' && f.sentiment !== sentimentFilter) return false;
      if (employeeFilter !== 'all' && f.to_user_id !== employeeFilter) return false;
      if (teamFilter !== 'all') {
        const prof = profileMap[f.to_user_id];
        if (!prof || prof.team_id !== teamFilter) return false;
      }
      return true;
    });
  }, [feedbackData, sentimentFilter, employeeFilter, teamFilter, profileMap]);

  const totalCount = filtered.length;
  const positiveCount = filtered.filter(f => f.sentiment === 'positive').length;
  const negativeCount = filtered.filter(f => f.sentiment === 'negative').length;
  const positiveRatio = totalCount > 0 ? Math.round((positiveCount / totalCount) * 100) : 0;

  const timeGranularity: 'week' | 'month' = ['3m', '6m', '1y'].includes(period) ? 'month' : 'week';

  // Top subcategories
  const topSubcats = useMemo(() => {
    const feedbackIds = new Set(filtered.map(f => f.id));
    const counts: Record<string, number> = {};
    feedbackSubs.forEach(fs => {
      if (!feedbackIds.has(fs.feedback_id)) return;
      counts[fs.subcategory_id] = (counts[fs.subcategory_id] || 0) + 1;
    });
    const positive = Object.entries(counts).filter(([id]) => subcatMap[id]?.sentiment === 'positive').sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, count]) => ({ name: subcatMap[id]?.name || id, count }));
    const negative = Object.entries(counts).filter(([id]) => subcatMap[id]?.sentiment === 'negative').sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, count]) => ({ name: subcatMap[id]?.name || id, count }));
    return { positive, negative };
  }, [filtered, feedbackSubs, subcatMap]);

  // Recipients table
  const recipientsTable = useMemo(() => {
    const data: Record<string, { total: number; positive: number; negative: number; subcats: Record<string, number> }> = {};
    const feedbackIds = new Set(filtered.map(f => f.id));
    filtered.forEach(f => {
      if (!data[f.to_user_id]) data[f.to_user_id] = { total: 0, positive: 0, negative: 0, subcats: {} };
      data[f.to_user_id].total++;
      data[f.to_user_id][f.sentiment as 'positive' | 'negative']++;
    });
    feedbackSubs.forEach(fs => {
      if (!feedbackIds.has(fs.feedback_id)) return;
      const fb = filtered.find(f => f.id === fs.feedback_id);
      if (!fb || !data[fb.to_user_id]) return;
      const name = subcatMap[fs.subcategory_id]?.name || '';
      data[fb.to_user_id].subcats[name] = (data[fb.to_user_id].subcats[name] || 0) + 1;
    });
    return Object.entries(data)
      .map(([userId, d]) => ({ userId, name: profileMap[userId]?.full_name || userId, ...d, topSubcats: Object.entries(d.subcats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, feedbackSubs, subcatMap, profileMap]);

  const graphEdges = useMemo(() => filtered.map(f => ({ from: f.from_user_id, to: f.to_user_id, sentiment: f.sentiment, created_at: f.created_at })), [filtered]);

  function exportRawCSV() {
    const feedbackIds = new Set(filtered.map(f => f.id));
    const subsByFb: Record<string, string[]> = {};
    feedbackSubs.forEach(fs => { if (!feedbackIds.has(fs.feedback_id)) return; if (!subsByFb[fs.feedback_id]) subsByFb[fs.feedback_id] = []; subsByFb[fs.feedback_id].push(subcatMap[fs.subcategory_id]?.name || ''); });
    const header = 'Дата,Эпизод,Команда,Получатель,Тональность,Подкатегории,Комментарий';
    const rows = filtered.map(f => {
      const prof = profileMap[f.to_user_id];
      const team = prof?.team_id ? teams.find(t => t.id === prof.team_id)?.name || '' : '';
      return [format(parseISO(f.created_at), 'yyyy-MM-dd'), `"${episodes[f.episode_id] || ''}"`, `"${team}"`, `"${prof?.full_name || ''}"`, f.sentiment === 'positive' ? 'Позитивный' : 'Негативный', `"${(subsByFb[f.id] || []).join('; ')}"`, `"${f.comment.replace(/"/g, '""')}"`].join(',');
    });
    downloadCSV([header, ...rows].join('\n'), 'feedback_raw.csv');
  }

  function exportAggCSV() {
    const header = 'Получатель,Команда,Всего,Позитивных,Негативных,Топ подкатегории';
    const rows = recipientsTable.map(r => {
      const prof = profileMap[r.userId];
      const team = prof?.team_id ? teams.find(t => t.id === prof.team_id)?.name || '' : '';
      return [`"${r.name}"`, `"${team}"`, r.total, r.positive, r.negative, `"${r.topSubcats.join('; ')}"`].join(',');
    });
    downloadCSV([header, ...rows].join('\n'), 'feedback_aggregated.csv');
  }

  function downloadCSV(content: string, filename: string) {
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Дашборд</h1>
            <p className="text-muted-foreground">Аналитика обратной связи</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportRawCSV} className="gap-1"><Download size={14} /> Сырой CSV</Button>
            <Button variant="outline" size="sm" onClick={exportAggCSV} className="gap-1"><Download size={14} /> Агрегат CSV</Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Период</Label>
                <Select value={period} onValueChange={v => setPeriod(v as PeriodPreset)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(periodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
                <Label className="text-xs text-muted-foreground">Получатель</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Тональность</Label>
                <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все</SelectItem>
                    <SelectItem value="positive">Позитивные</SelectItem>
                    <SelectItem value="negative">Негативные</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><MessageSquare size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{totalCount}</p><p className="text-xs text-muted-foreground">Всего отзывов</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/10"><TrendingUp size={18} className="text-positive" /></div><div><p className="text-2xl font-bold">{positiveCount}</p><p className="text-xs text-muted-foreground">Позитивных</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-negative/10"><TrendingDown size={18} className="text-negative" /></div><div><p className="text-2xl font-bold">{negativeCount}</p><p className="text-xs text-muted-foreground">Негативных</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><BarChart3 size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{positiveRatio}%</p><p className="text-xs text-muted-foreground">Позитивных</p></div></div></CardContent></Card>
        </div>

        {/* Sentiment Timeline (Area chart) */}
        <SentimentTimeline data={filtered} granularity={timeGranularity} />

        {/* Employee Bar Chart */}
        <EmployeeBarChart profiles={profiles} feedbackEdges={graphEdges} />

        {/* Top subcategories */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base text-positive">Топ позитивных подкатегорий</CardTitle></CardHeader>
            <CardContent>
              {topSubcats.positive.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RBarChart data={topSubcats.positive} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--positive))" radius={[0, 4, 4, 0]} name="Кол-во" />
                  </RBarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base text-negative">Топ негативных подкатегорий</CardTitle></CardHeader>
            <CardContent>
              {topSubcats.negative.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <RBarChart data={topSubcats.negative} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--negative))" radius={[0, 4, 4, 0]} name="Кол-во" />
                  </RBarChart>
                </ResponsiveContainer>
              ) : <p className="text-muted-foreground text-sm">Нет данных</p>}
            </CardContent>
          </Card>
        </div>

        {/* Recipients table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Получатели (агрегат)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead className="text-center">Всего</TableHead>
                  <TableHead className="text-center">Позитивных</TableHead>
                  <TableHead className="text-center">Негативных</TableHead>
                  <TableHead>Топ подкатегории</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipientsTable.map(r => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-center">{r.total}</TableCell>
                    <TableCell className="text-center text-positive font-medium">{r.positive}</TableCell>
                    <TableCell className="text-center text-negative font-medium">{r.negative}</TableCell>
                    <TableCell><div className="flex gap-1 flex-wrap">{r.topSubcats.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div></TableCell>
                  </TableRow>
                ))}
                {recipientsTable.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет данных</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Комментарии (обезличенные)</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Показать</Label>
                <Switch checked={showComments} onCheckedChange={setShowComments} />
              </div>
            </div>
          </CardHeader>
          {showComments && (
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filtered.map(f => (
                  <div key={f.id} className="p-3 rounded-lg bg-muted/50 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={f.sentiment === 'positive' ? 'default' : 'destructive'} className={cn("text-xs", f.sentiment === 'positive' && 'bg-positive')}>{f.sentiment === 'positive' ? 'Позитивный' : 'Негативный'}</Badge>
                      <span className="text-xs text-muted-foreground">{format(parseISO(f.created_at), 'dd.MM.yyyy')}</span>
                      <span className="text-xs text-muted-foreground">→ {profileMap[f.to_user_id]?.full_name}</span>
                      <span className="text-xs text-muted-foreground">({episodes[f.episode_id] || ''})</span>
                    </div>
                    <p className="text-foreground">{f.comment}</p>
                  </div>
                ))}
                {filtered.length === 0 && <p className="text-center text-muted-foreground py-4">Нет комментариев</p>}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Relationship Graph */}
        <RelationshipGraph profiles={profiles} feedbackEdges={graphEdges} />

        {/* Heatmap */}
        <InteractionHeatmap profiles={profiles} feedbackEdges={graphEdges} />

        {/* Conflict Matrix */}
        <ConflictMatrix profiles={profiles} feedbackEdges={graphEdges} />
      </div>
    </AppLayout>
  );
}
