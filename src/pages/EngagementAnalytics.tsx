import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell } from 'recharts';
import { Zap, MessageSquare, Heart } from 'lucide-react';
import { subDays, subMonths } from 'date-fns';
import type { Profile, Team } from '@/lib/supabase-types';

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

export default function EngagementAnalytics() {
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [kudosData, setKudosData] = useState<any[]>([]);
  const [assignmentsData, setAssignmentsData] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    const startDate = getPeriodStart(period).toISOString();
    const [fbRes, kudosRes, assignRes, profRes, teamRes] = await Promise.all([
      supabase.from('feedback').select('id, sentiment, from_user_id, to_user_id, is_critical, created_at').gte('created_at', startDate).eq('is_critical', false),
      supabase.from('kudos').select('id, from_user_id, created_at').gte('created_at', startDate),
      supabase.from('survey_assignments').select('id, user_id, status'),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
    ]);
    if (fbRes.data) setFeedbackData(fbRes.data);
    if (kudosRes.data) setKudosData(kudosRes.data);
    if (assignRes.data) setAssignmentsData(assignRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const activeProfiles = useMemo(() => {
    return profiles.filter(p => {
      if (!p.is_active) return false;
      if (teamFilter !== 'all' && p.team_id !== teamFilter) return false;
      return true;
    });
  }, [profiles, teamFilter]);

  // Calculate engagement per employee
  const engagementData = useMemo(() => {
    const fbCount: Record<string, number> = {};
    const fbReceivedCount: Record<string, { pos: number; neg: number; total: number }> = {};
    const kudosCount: Record<string, number> = {};
    const surveyStats: Record<string, { total: number; submitted: number }> = {};

    feedbackData.forEach(f => {
      fbCount[f.from_user_id] = (fbCount[f.from_user_id] || 0) + 1;
      if (!fbReceivedCount[f.to_user_id]) fbReceivedCount[f.to_user_id] = { pos: 0, neg: 0, total: 0 };
      fbReceivedCount[f.to_user_id].total++;
      if (f.sentiment === 'positive') fbReceivedCount[f.to_user_id].pos++;
      else fbReceivedCount[f.to_user_id].neg++;
    });

    kudosData.forEach(k => {
      kudosCount[k.from_user_id] = (kudosCount[k.from_user_id] || 0) + 1;
    });

    assignmentsData.forEach(a => {
      if (!surveyStats[a.user_id]) surveyStats[a.user_id] = { total: 0, submitted: 0 };
      surveyStats[a.user_id].total++;
      if (a.status === 'submitted') surveyStats[a.user_id].submitted++;
    });

    // Average feedback count
    const totalFbGiven = Object.values(fbCount).reduce((a, b) => a + b, 0);
    const avgFb = activeProfiles.length > 0 ? totalFbGiven / activeProfiles.length : 1;

    return activeProfiles.map(p => {
      const fb = fbCount[p.id] || 0;
      const kd = kudosCount[p.id] || 0;
      const sv = surveyStats[p.id];
      const surveyCompletion = sv ? (sv.total > 0 ? sv.submitted / sv.total : 0) : 0;

      // Engagement Score: weighted average
      const fbScore = avgFb > 0 ? fb / avgFb : 0;
      const kdScore = kd > 0 ? Math.min(kd / 3, 2) : 0; // normalize kudos
      const engagementScore = (fbScore * 0.5 + kdScore * 0.2 + surveyCompletion * 0.3);

      const received = fbReceivedCount[p.id] || { pos: 0, neg: 0, total: 0 };
      const satisfaction = received.total > 0 ? Math.round((received.pos / received.total) * 100) : 50;

      return {
        id: p.id,
        name: p.full_name,
        feedbackGiven: fb,
        kudosGiven: kd,
        surveyCompletion: Math.round(surveyCompletion * 100),
        engagementScore: Number(engagementScore.toFixed(2)),
        satisfaction,
        receivedTotal: received.total,
      };
    }).sort((a, b) => b.engagementScore - a.engagementScore);
  }, [feedbackData, kudosData, assignmentsData, activeProfiles, profileMap]);

  // Average engagement
  const avgEngagement = useMemo(() => {
    if (engagementData.length === 0) return 0;
    return Number((engagementData.reduce((s, d) => s + d.engagementScore, 0) / engagementData.length).toFixed(2));
  }, [engagementData]);

  // Scatter data for engagement vs satisfaction
  const scatterData = useMemo(() => {
    return engagementData.filter(d => d.receivedTotal >= 1).map(d => ({
      x: d.engagementScore,
      y: d.satisfaction,
      z: Math.max(d.receivedTotal, 3),
      name: d.name,
    }));
  }, [engagementData]);

  function getScatterColor(x: number, y: number): string {
    if (x >= 0.8 && y >= 60) return 'hsl(var(--positive))'; // Active & positive
    if (x >= 0.8 && y < 60) return 'hsl(var(--chart-4))'; // Active but conflicting
    if (x < 0.5 && y >= 70) return 'hsl(var(--chart-1))'; // Quiet star
    return 'hsl(var(--muted-foreground))'; // Passive
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Вовлечённость сотрудников</h1>
          <p className="text-muted-foreground">Активность участия в жизни команды</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10"><Zap size={18} className="text-accent" /></div>
                <div>
                  <p className="text-3xl font-bold">{avgEngagement}</p>
                  <p className="text-xs text-muted-foreground">Средний индекс</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><MessageSquare size={18} className="text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{feedbackData.length}</p>
                  <p className="text-xs text-muted-foreground">Отзывов оставлено</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-positive/10"><Heart size={18} className="text-positive" /></div>
                <div>
                  <p className="text-2xl font-bold">{kudosData.length}</p>
                  <p className="text-xs text-muted-foreground">Благодарностей</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Активность по сотрудникам</CardTitle></CardHeader>
          <CardContent>
            {engagementData.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, engagementData.length * 30)}>
                <BarChart data={engagementData.slice(0, 20)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="feedbackGiven" fill="hsl(var(--primary))" name="Отзывы" stackId="a" />
                  <Bar dataKey="kudosGiven" fill="hsl(var(--positive))" name="Благодарности" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
          </CardContent>
        </Card>

        {/* Scatter plot: Engagement vs Satisfaction */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Карта: вовлечённость × удовлетворённость</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Размер точки = количество полученных отзывов. Цвет: 🟢 активный+позитивный, 🟡 активный+напряжение, 🔵 тихая звезда, ⚫ пассивный</p>
          </CardHeader>
          <CardContent>
            {scatterData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="x" name="Вовлечённость" tick={{ fontSize: 11 }} label={{ value: 'Вовлечённость', position: 'insideBottom', offset: -5, fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="Удовлетворённость %" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: 'Удовлетворённость %', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <ZAxis type="number" dataKey="z" range={[40, 400]} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-background border border-border rounded-lg p-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p>Вовлечённость: {d.x}</p>
                          <p>Удовлетворённость: {d.y}%</p>
                          <p>Отзывов получено: {d.z}</p>
                        </div>
                      );
                    }}
                  />
                  <Scatter data={scatterData}>
                    {scatterData.map((entry, i) => (
                      <Cell key={i} fill={getScatterColor(entry.x, entry.y)} fillOpacity={0.7} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
