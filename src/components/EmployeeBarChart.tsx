import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { Profile } from '@/lib/supabase-types';

interface FeedbackEdge {
  from: string;
  to: string;
  sentiment: string;
}

interface Props {
  profiles: Profile[];
  feedbackEdges: FeedbackEdge[];
}

type SortMode = 'total' | 'positive' | 'negative';

export function EmployeeBarChart({ profiles, feedbackEdges }: Props) {
  const [sortBy, setSortBy] = useState<SortMode>('total');

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  const data = useMemo(() => {
    const counts: Record<string, { positive: number; negative: number }> = {};
    feedbackEdges.forEach(e => {
      if (!counts[e.to]) counts[e.to] = { positive: 0, negative: 0 };
      if (e.sentiment === 'positive') counts[e.to].positive++;
      else counts[e.to].negative++;
    });

    return Object.entries(counts)
      .map(([id, c]) => ({
        name: profileMap[id]?.full_name || id.slice(0, 8),
        Позитивные: c.positive,
        Негативные: c.negative,
        total: c.positive + c.negative,
      }))
      .sort((a, b) => {
        if (sortBy === 'positive') return b.Позитивные - a.Позитивные;
        if (sortBy === 'negative') return b.Негативные - a.Негативные;
        return b.total - a.total;
      });
  }, [feedbackEdges, profileMap, sortBy]);

  if (data.length === 0) {
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Позитив / Негатив по сотрудникам</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Сортировка</Label>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortMode)}>
              <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="total">По общему кол-ву</SelectItem>
                <SelectItem value="positive">По позитивным</SelectItem>
                <SelectItem value="negative">По негативным</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
