import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Search, RotateCcw } from 'lucide-react';
import type { Profile, Team } from '@/lib/supabase-types';

interface FeedbackEdge {
  from: string;
  to: string;
  sentiment: string;
}

interface Props {
  profiles: Profile[];
  feedbackEdges: FeedbackEdge[];
  teams?: Team[];
}

type SortMode = 'total' | 'positive' | 'negative' | 'balance';
type TopLimit = '20' | '50' | 'all';

export function EmployeeBarChart({ profiles, feedbackEdges, teams = [] }: Props) {
  const [sortBy, setSortBy] = useState<SortMode>('total');
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [topLimit, setTopLimit] = useState<TopLimit>('20');

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const allData = useMemo(() => {
    const counts: Record<string, { positive: number; negative: number }> = {};
    feedbackEdges.forEach(e => {
      if (!counts[e.to]) counts[e.to] = { positive: 0, negative: 0 };
      if (e.sentiment === 'positive') counts[e.to].positive++;
      else counts[e.to].negative++;
    });

    return Object.entries(counts).map(([id, c]) => ({
      id,
      name: profileMap[id]?.full_name || id.slice(0, 8),
      teamId: profileMap[id]?.team_id || null,
      Позитивные: c.positive,
      Негативные: c.negative,
      total: c.positive + c.negative,
      balance: c.positive - c.negative,
    }));
  }, [feedbackEdges, profileMap]);

  const data = useMemo(() => {
    let result = allData.filter(d => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter !== 'all' && d.teamId !== teamFilter) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'positive': return b.Позитивные - a.Позитивные;
        case 'negative': return b.Негативные - a.Негативные;
        case 'balance': return b.balance - a.balance;
        default: return b.total - a.total;
      }
    });

    if (topLimit !== 'all') result = result.slice(0, Number(topLimit));
    return result;
  }, [allData, sortBy, search, teamFilter, topLimit]);

  const hasFilters = search || teamFilter !== 'all' || sortBy !== 'total' || topLimit !== '20';

  function resetFilters() {
    setSearch(''); setTeamFilter('all'); setSortBy('total'); setTopLimit('20');
  }

  if (allData.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Отзывы по сотрудникам</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm text-center py-6">Нет данных</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Позитив / Негатив по сотрудникам</CardTitle>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs gap-1">
              <RotateCcw size={12} /> Сбросить
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="pl-8 h-8 text-xs" />
          </div>
          {teams.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Команда" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все команды</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortMode)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">По общему кол-ву</SelectItem>
              <SelectItem value="positive">По позитивным</SelectItem>
              <SelectItem value="negative">По негативным</SelectItem>
              <SelectItem value="balance">По балансу</SelectItem>
            </SelectContent>
          </Select>
          <Select value={topLimit} onValueChange={v => setTopLimit(v as TopLimit)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="20">Топ-20</SelectItem>
              <SelectItem value="50">Топ-50</SelectItem>
              <SelectItem value="all">Все</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
            <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Позитивные" stackId="a" fill="hsl(var(--positive))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Негативные" stackId="a" fill="hsl(var(--negative))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-muted-foreground text-sm text-center py-6">Нет данных</p>}

        <p className="text-[10px] text-muted-foreground text-right">
          Показано: {data.length} из {allData.length}
        </p>
      </CardContent>
    </Card>
  );
}
