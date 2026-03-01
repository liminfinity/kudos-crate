import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Lightbulb, RefreshCw, User, Users, Building2 } from 'lucide-react';
import { subMonths } from 'date-fns';
import type { Profile, Team } from '@/lib/supabase-types';

type Scope = 'employee' | 'team' | 'company';

export default function Recommendations() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Record<Scope, { text: string; generatedAt: string } | null>>({
    employee: null, team: null, company: null,
  });

  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [kudosData, setKudosData] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const startDate = subMonths(new Date(), 6).toISOString();
    const [fbRes, kudosRes, profRes, teamRes] = await Promise.all([
      supabase.from('feedback').select('id, sentiment, from_user_id, to_user_id, is_critical, created_at').gte('created_at', startDate).eq('is_critical', false),
      supabase.from('kudos').select('id, from_user_id, to_user_id, category, created_at').gte('created_at', startDate),
      supabase.from('profiles').select('*'),
      supabase.from('teams').select('*'),
    ]);
    if (fbRes.data) setFeedbackData(fbRes.data);
    if (kudosRes.data) setKudosData(kudosRes.data);
    if (profRes.data) setProfiles(profRes.data as unknown as Profile[]);
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  function buildSummary(scope: Scope) {
    if (scope === 'employee' && user) {
      const received = feedbackData.filter(f => f.to_user_id === user.id);
      const given = feedbackData.filter(f => f.from_user_id === user.id);
      const kudosReceived = kudosData.filter(k => k.to_user_id === user.id);
      const kudosGiven = kudosData.filter(k => k.from_user_id === user.id);
      return {
        feedback_received: received.length,
        positive_received: received.filter(f => f.sentiment === 'positive').length,
        negative_received: received.filter(f => f.sentiment === 'negative').length,
        feedback_given: given.length,
        kudos_received: kudosReceived.length,
        kudos_given: kudosGiven.length,
        satisfaction_pct: received.length > 0 ? Math.round((received.filter(f => f.sentiment === 'positive').length / received.length) * 100) : null,
      };
    }

    if (scope === 'team' && user) {
      const myTeamId = profileMap[user.id]?.team_id;
      const teamMembers = profiles.filter(p => p.team_id === myTeamId).map(p => p.id);
      const teamFb = feedbackData.filter(f => teamMembers.includes(f.to_user_id));
      const teamName = teams.find(t => t.id === myTeamId)?.name || 'Моя команда';
      return {
        team_name: teamName,
        total_feedback: teamFb.length,
        positive: teamFb.filter(f => f.sentiment === 'positive').length,
        negative: teamFb.filter(f => f.sentiment === 'negative').length,
        satisfaction_pct: teamFb.length > 0 ? Math.round((teamFb.filter(f => f.sentiment === 'positive').length / teamFb.length) * 100) : null,
        members_count: teamMembers.length,
        kudos_total: kudosData.filter(k => teamMembers.includes(k.from_user_id)).length,
      };
    }

    // Company
    const pos = feedbackData.filter(f => f.sentiment === 'positive').length;
    return {
      total_feedback: feedbackData.length,
      positive: pos,
      negative: feedbackData.length - pos,
      satisfaction_pct: feedbackData.length > 0 ? Math.round((pos / feedbackData.length) * 100) : null,
      teams_count: teams.length,
      employees_count: profiles.filter(p => p.is_active).length,
      kudos_total: kudosData.length,
    };
  }

  async function generateRecommendations(scope: Scope) {
    setLoading(true);
    try {
      const summary = buildSummary(scope);
      const { data, error } = await supabase.functions.invoke('recommendations', {
        body: { scope, data_summary: summary },
      });
      if (error) throw error;
      setRecommendations(prev => ({
        ...prev,
        [scope]: { text: data.recommendations, generatedAt: data.generated_at },
      }));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Determine available tabs based on role
  const availableTabs: { value: Scope; label: string; icon: React.ReactNode }[] = [];
  availableTabs.push({ value: 'employee', label: 'Для меня', icon: <User size={14} /> });
  if (role && ['manager', 'hr', 'admin'].includes(role)) {
    availableTabs.push({ value: 'team', label: 'Для команды', icon: <Users size={14} /> });
  }
  if (role && ['hr', 'admin'].includes(role)) {
    availableTabs.push({ value: 'company', label: 'Для компании', icon: <Building2 size={14} /> });
  }

  const defaultTab = availableTabs[0]?.value || 'employee';

  return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb size={24} className="text-accent" />
            Рекомендации
          </h1>
          <p className="text-muted-foreground">Интеллектуальный анализ и советы на основе данных</p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {availableTabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                {t.icon} {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {availableTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tab.label}</CardTitle>
                    <Button
                      size="sm"
                      onClick={() => generateRecommendations(tab.value)}
                      disabled={loading}
                      className="gap-1.5"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      {recommendations[tab.value] ? 'Обновить анализ' : 'Сгенерировать'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recommendations[tab.value] ? (
                    <div>
                      <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                        {recommendations[tab.value]!.text}
                      </div>
                      <p className="text-xs text-muted-foreground mt-4">
                        Сгенерировано: {new Date(recommendations[tab.value]!.generatedAt).toLocaleString('ru-RU')}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Lightbulb size={40} className="mx-auto mb-3 opacity-30" />
                      <p>Нажмите «Сгенерировать» для получения рекомендаций</p>
                      <p className="text-xs mt-1">Анализ основан на данных за последние 6 месяцев</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
    </div>
  );
}
