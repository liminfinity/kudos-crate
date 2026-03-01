import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO, startOfWeek, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

interface FeedbackRow {
  id: string;
  sentiment: string;
  created_at: string;
}

interface Props {
  data: FeedbackRow[];
  granularity: 'week' | 'month';
}

export function SentimentTimeline({ data, granularity }: Props) {
  const series = useMemo(() => {
    const buckets: Record<string, { positive: number; negative: number }> = {};
    const useMonths = granularity === 'month';

    data.forEach(f => {
      const d = parseISO(f.created_at);
      const key = useMonths
        ? format(startOfMonth(d), 'yyyy-MM')
        : format(startOfWeek(d, { locale: ru }), 'yyyy-MM-dd');
      if (!buckets[key]) buckets[key] = { positive: 0, negative: 0 };
      buckets[key][f.sentiment as 'positive' | 'negative']++;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        period: useMonths
          ? format(parseISO(key + '-01'), 'MMM yyyy', { locale: ru })
          : format(parseISO(key), 'dd MMM', { locale: ru }),
        Позитивные: val.positive,
        Негативные: val.negative,
      }));
  }, [data, granularity]);

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Динамика эмоций</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm text-center py-6">Нет данных</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Динамика эмоций по времени</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(152, 56%, 40%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(152, 56%, 40%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(4, 76%, 56%)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(4, 76%, 56%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="period" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="Позитивные" stroke="hsl(152, 56%, 40%)" fill="url(#gradPos)" strokeWidth={2} />
            <Area type="monotone" dataKey="Негативные" stroke="hsl(4, 76%, 56%)" fill="url(#gradNeg)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
