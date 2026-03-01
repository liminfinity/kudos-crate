import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Activity, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Profile, Team } from '@/lib/supabase-types';

type PeriodPreset = '3m' | '6m' | '1y';

function getMoodColor(value: number): string {
  if (value >= 0.3) return 'hsl(152, 56%, 40%)';
  if (value >= 0.05) return 'hsl(152, 40%, 55%)';
  if (value >= -0.05) return 'hsl(45, 80%, 50%)';
  if (value >= -0.3) return 'hsl(20, 80%, 55%)';
  return 'hsl(4, 76%, 50%)';
}

function getMoodLabel(value: number): string {
  if (value >= 0.3) return 'Позитивно';
  if (value >= 0.05) return 'Хорошо';
  if (value >= -0.05) return 'Нейтрально';
  if (value >= -0.3) return 'Напряжение';
  return 'Риск';
}

export default function CompanyMood() {
  const { role } = useAuth();
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [leaderResponses, setLeaderResponses] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    const startDate = subMonths(new Date(), period === '3m' ? 3 : period === '6m' ? 6 : 12).toISOString();
    const [fbRes, profRes, teamRes, srRes, lrRes] = await Promise.all([
      supabase.from('feedback').select('id, sentiment, created_at, to_user_id, is_critical').gte('created_at', startDate),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('survey_responses').select('id, answers_json, created_at, assignment_id').gte('created_at', startDate),
      supabase.from('survey_assignments').select('id, status, cycle_id, user_id, team_id'),
    ]);
    if (fbRes.data) setFeedbackData(fbRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
    if (srRes.data) setSurveyResponses(srRes.data);
    if (lrRes.data) setLeaderResponses(lrRes.data);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  // Filter non-critical feedback for CSI
  const nonCriticalFb = useMemo(() => {
    return feedbackData.filter(f => {
      if (f.is_critical) return false;
      if (teamFilter !== 'all') {
        const prof = profileMap[f.to_user_id];
        if (!prof || prof.team_id !== teamFilter) return false;
      }
      return true;
    });
  }, [feedbackData, teamFilter, profileMap]);

  // CSI
  const csi = useMemo(() => {
    if (nonCriticalFb.length === 0) return 0;
    const pos = nonCriticalFb.filter(f => f.sentiment === 'positive').length;
    const neg = nonCriticalFb.filter(f => f.sentiment === 'negative').length;
    return (pos - neg) / nonCriticalFb.length;
  }, [nonCriticalFb]);

  // Final mood index (simplified - just CSI for now since survey mood extraction is complex)
  const finalMoodIndex = csi;

  // Monthly CSI timeline
  const monthlyTimeline = useMemo(() => {
    const months: Record<string, { pos: number; neg: number; total: number }> = {};
    nonCriticalFb.forEach(f => {
      const month = format(parseISO(f.created_at), 'yyyy-MM');
      if (!months[month]) months[month] = { pos: 0, neg: 0, total: 0 };
      months[month].total++;
      if (f.sentiment === 'positive') months[month].pos++;
      else months[month].neg++;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        month: format(parseISO(month + '-01'), 'MMM yyyy', { locale: ru }),
        csi: d.total > 0 ? Number(((d.pos - d.neg) / d.total).toFixed(3)) : 0,
        positive: d.pos,
        negative: d.neg,
      }));
  }, [nonCriticalFb]);

  // Team breakdown
  const teamBreakdown = useMemo(() => {
    const data: Record<string, { name: string; pos: number; neg: number; total: number }> = {};
    nonCriticalFb.forEach(f => {
      const prof = profileMap[f.to_user_id];
      const teamId = prof?.team_id || 'unknown';
      const teamName = teams.find(t => t.id === teamId)?.name || 'Без команды';
      if (!data[teamId]) data[teamId] = { name: teamName, pos: 0, neg: 0, total: 0 };
      data[teamId].total++;
      if (f.sentiment === 'positive') data[teamId].pos++;
      else data[teamId].neg++;
    });
    return Object.values(data).map(d => ({
      ...d,
      csi: d.total > 0 ? Number(((d.pos - d.neg) / d.total).toFixed(3)) : 0,
    })).sort((a, b) => b.csi - a.csi);
  }, [nonCriticalFb, profileMap, teams]);

  // Survey completion rate
  const completionRate = useMemo(() => {
    if (leaderResponses.length === 0) return 0;
    const submitted = leaderResponses.filter(a => a.status === 'submitted').length;
    return Math.round((submitted / leaderResponses.length) * 100);
  }, [leaderResponses]);

  const moodColor = getMoodColor(finalMoodIndex);
  const moodLabel = getMoodLabel(finalMoodIndex);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Состояние атмосферы</h1>
          <p className="text-muted-foreground">Общее эмоциональное состояние компании</p>
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

        {/* Big Mood Indicator */}
        <Card>
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center mb-4 transition-colors"
                style={{ backgroundColor: moodColor + '22', border: `3px solid ${moodColor}` }}
              >
                <span className="text-3xl font-bold" style={{ color: moodColor }}>
                  {(finalMoodIndex >= 0 ? '+' : '') + finalMoodIndex.toFixed(2)}
                </span>
              </div>
              <p className="text-lg font-semibold" style={{ color: moodColor }}>{moodLabel}</p>
              <p className="text-sm text-muted-foreground mt-1">
                CSI = (Позитивные − Негативные) / Всего отзывов
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Activity size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{nonCriticalFb.length}</p><p className="text-xs text-muted-foreground">Отзывов</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/10"><TrendingUp size={18} className="text-positive" /></div><div><p className="text-2xl font-bold">{nonCriticalFb.filter(f => f.sentiment === 'positive').length}</p><p className="text-xs text-muted-foreground">Позитивных</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Users size={18} className="text-primary" /></div><div><p className="text-2xl font-bold">{teams.length}</p><p className="text-xs text-muted-foreground">Команд</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-positive/10"><CheckCircle2 size={18} className="text-positive" /></div><div><p className="text-2xl font-bold">{completionRate}%</p><p className="text-xs text-muted-foreground">Опросы заполнены</p></div></div></CardContent></Card>
        </div>

        {/* Monthly timeline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Динамика CSI по месяцам</CardTitle></CardHeader>
          <CardContent>
            {monthlyTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyTimeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="csi" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="CSI" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
          </CardContent>
        </Card>

        {/* Team breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">CSI по командам</CardTitle></CardHeader>
          <CardContent>
            {teamBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[-1, 1]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pos" fill="hsl(var(--positive))" name="Позитивные" stackId="stack" />
                  <Bar dataKey="neg" fill="hsl(var(--negative))" name="Негативные" stackId="stack" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
