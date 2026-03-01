import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { ThumbsUp, Users, Building2 } from 'lucide-react';
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

function getSatisfactionColor(pct: number): string {
  if (pct >= 75) return 'hsl(var(--positive))';
  if (pct >= 50) return 'hsl(var(--chart-4))';
  return 'hsl(var(--negative))';
}

export default function SatisfactionAnalytics() {
  const [period, setPeriod] = useState<PeriodPreset>('6m');
  const [teamFilter, setTeamFilter] = useState('all');
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => { loadData(); }, [period]);

  async function loadData() {
    const startDate = getPeriodStart(period).toISOString();
    const [fbRes, profRes, teamRes] = await Promise.all([
      supabase.from('feedback').select('id, sentiment, to_user_id, is_critical, created_at').gte('created_at', startDate).eq('is_critical', false),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
    ]);
    if (fbRes.data) setFeedbackData(fbRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    return feedbackData.filter(f => {
      if (teamFilter !== 'all') {
        const prof = profileMap[f.to_user_id];
        if (!prof || prof.team_id !== teamFilter) return false;
      }
      return true;
    });
  }, [feedbackData, teamFilter, profileMap]);

  // Company-wide satisfaction
  const companySat = useMemo(() => {
    if (filtered.length === 0) return 0;
    const pos = filtered.filter(f => f.sentiment === 'positive').length;
    return Math.round((pos / filtered.length) * 100);
  }, [filtered]);

  // Team satisfaction
  const teamSat = useMemo(() => {
    const data: Record<string, { name: string; pos: number; total: number }> = {};
    filtered.forEach(f => {
      const prof = profileMap[f.to_user_id];
      const teamId = prof?.team_id || 'none';
      const teamName = teams.find(t => t.id === teamId)?.name || 'Без команды';
      if (!data[teamId]) data[teamId] = { name: teamName, pos: 0, total: 0 };
      data[teamId].total++;
      if (f.sentiment === 'positive') data[teamId].pos++;
    });
    return Object.values(data).map(d => ({
      name: d.name,
      satisfaction: d.total > 0 ? Math.round((d.pos / d.total) * 100) : 0,
      total: d.total,
    })).sort((a, b) => b.satisfaction - a.satisfaction);
  }, [filtered, profileMap, teams]);

  // Employee satisfaction
  const employeeSat = useMemo(() => {
    const data: Record<string, { pos: number; total: number }> = {};
    filtered.forEach(f => {
      if (!data[f.to_user_id]) data[f.to_user_id] = { pos: 0, total: 0 };
      data[f.to_user_id].total++;
      if (f.sentiment === 'positive') data[f.to_user_id].pos++;
    });
    return Object.entries(data)
      .map(([userId, d]) => ({
        name: profileMap[userId]?.full_name || 'Неизвестно',
        satisfaction: d.total > 0 ? Math.round((d.pos / d.total) * 100) : 0,
        total: d.total,
      }))
      .filter(d => d.total >= 2)
      .sort((a, b) => b.satisfaction - a.satisfaction);
  }, [filtered, profileMap]);

  return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Удовлетворённость команды</h1>
          <p className="text-muted-foreground">Индекс удовлетворённости на основе обратной связи</p>
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

        {/* Company-wide KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><ThumbsUp size={18} className="text-primary" /></div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: getSatisfactionColor(companySat) }}>{companySat}%</p>
                  <p className="text-xs text-muted-foreground">Общий индекс</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Building2 size={18} className="text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{teamSat.length}</p>
                  <p className="text-xs text-muted-foreground">Команд в анализе</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Users size={18} className="text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">{filtered.length}</p>
                  <p className="text-xs text-muted-foreground">Отзывов учтено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team satisfaction bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Удовлетворённость по командам</CardTitle></CardHeader>
          <CardContent>
            {teamSat.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamSat}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Удовлетворённость']} />
                  <Bar dataKey="satisfaction" radius={[4, 4, 0, 0]} name="Удовлетворённость">
                    {teamSat.map((entry, i) => (
                      <Cell key={i} fill={getSatisfactionColor(entry.satisfaction)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных</p>}
          </CardContent>
        </Card>

        {/* Employee satisfaction histogram */}
        <Card>
          <CardHeader><CardTitle className="text-base">Удовлетворённость по сотрудникам</CardTitle></CardHeader>
          <CardContent>
            {employeeSat.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, employeeSat.length * 35)}>
                <BarChart data={employeeSat} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Удовлетворённость']} />
                  <Bar dataKey="satisfaction" radius={[0, 4, 4, 0]} name="Удовлетворённость">
                    {employeeSat.map((entry, i) => (
                      <Cell key={i} fill={getSatisfactionColor(entry.satisfaction)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-sm text-center py-8">Нет данных (минимум 2 отзыва на сотрудника)</p>}
          </CardContent>
        </Card>
    </div>
  );
}
