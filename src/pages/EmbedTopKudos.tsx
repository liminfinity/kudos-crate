import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Heart, Trophy } from 'lucide-react';
import type { Profile, Team } from '@/lib/supabase-types';
import { subDays } from 'date-fns';

const CATEGORY_LABELS: Record<string, string> = {
  helped_understand: 'Помог разобраться',
  emotional_support: 'Поддержка',
  saved_deadline: 'Спас дедлайн',
  shared_expertise: 'Экспертиза',
  mentoring: 'Наставничество',
  team_support: 'Командная поддержка',
};

export default function EmbedTopKudos() {
  const params = new URLSearchParams(window.location.search);
  const periodParam = params.get('period') || '30d';
  const teamIdParam = params.get('teamId') || '';
  const limitParam = Number(params.get('limit') || '10');
  const theme = params.get('theme') || 'light';

  const [kudos, setKudos] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    loadData();
  }, []);

  async function loadData() {
    const days = periodParam === '7d' ? 7 : periodParam === '90d' ? 90 : 30;
    const startDate = subDays(new Date(), days).toISOString();
    const [kRes, pRes] = await Promise.all([
      supabase.from('kudos').select('*').gte('created_at', startDate),
      supabase.from('profiles').select('*'),
    ]);
    if (kRes.data) setKudos(kRes.data);
    if (pRes.data) setProfiles(pRes.data as unknown as Profile[]);
  }

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const topReceivers = useMemo(() => {
    let filtered = kudos;
    if (teamIdParam) {
      filtered = kudos.filter(k => profileMap[k.to_user_id]?.team_id === teamIdParam);
    }
    const counts: Record<string, { count: number; categories: Record<string, number> }> = {};
    filtered.forEach(k => {
      if (!counts[k.to_user_id]) counts[k.to_user_id] = { count: 0, categories: {} };
      counts[k.to_user_id].count++;
      counts[k.to_user_id].categories[k.category] = (counts[k.to_user_id].categories[k.category] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, limitParam)
      .map(([uid, d]) => ({
        name: profileMap[uid]?.full_name || 'Сотрудник',
        count: d.count,
        topCategory: Object.entries(d.categories).sort(([, a], [, b]) => b - a)[0]?.[0] || '',
      }));
  }, [kudos, profileMap, teamIdParam, limitParam]);

  const periodLabel = periodParam === '7d' ? '7 дней' : periodParam === '90d' ? '90 дней' : '30 дней';

  return (
    <div className="p-4 max-w-lg mx-auto font-sans">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} className="text-chart-4" />
        <h2 className="text-lg font-bold">Топ по благодарностям</h2>
        <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
      </div>
      <div className="space-y-2">
        {topReceivers.map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.name}</p>
              {r.topCategory && (
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.topCategory] || r.topCategory}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Heart size={14} className="text-positive" />
              <span className="font-bold text-sm">{r.count}</span>
            </div>
          </div>
        ))}
        {topReceivers.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Нет данных за выбранный период</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-4">Powered by МИРА</p>
    </div>
  );
}
