import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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

export function ConflictMatrix({ profiles, feedbackEdges }: Props) {
  const { matrix, users } = useMemo(() => {
    const userIds = new Set<string>();
    feedbackEdges.forEach(e => { userIds.add(e.from); userIds.add(e.to); });
    const users = profiles.filter(p => userIds.has(p.id));

    // Bidirectional matrix (sorted key)
    const matrix: Record<string, { positive: number; negative: number }> = {};
    feedbackEdges.forEach(e => {
      const key = [e.from, e.to].sort().join('|');
      if (!matrix[key]) matrix[key] = { positive: 0, negative: 0 };
      if (e.sentiment === 'positive') matrix[key].positive++;
      else matrix[key].negative++;
    });

    return { matrix, users };
  }, [profiles, feedbackEdges]);

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Матрица конфликтов</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm text-center py-6">Нет данных</p></CardContent>
      </Card>
    );
  }

  function getCell(a: string, b: string) {
    const key = [a, b].sort().join('|');
    return matrix[key] || null;
  }

  function cellBadge(c: { positive: number; negative: number } | null) {
    if (!c) return null;
    const total = c.positive + c.negative;
    if (total === 0) return null;

    if (c.negative > c.positive) {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">⚠ {c.negative}</Badge>;
    }
    if (c.positive > c.negative) {
      return <Badge className="bg-positive text-[10px] px-1.5 py-0">✓ {c.positive}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">≈ {total}</Badge>;
  }

  const shortName = (name: string) => name.length > 10 ? name.slice(0, 9) + '…' : name;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Матрица конфликтов</CardTitle>
        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
          <span>⚠ — преобладают негативные</span>
          <span>✓ — преобладают позитивные</span>
          <span>≈ — поровну</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider delayDuration={0}>
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-muted-foreground font-normal min-w-[80px]"></th>
                {users.map(u => (
                  <th key={u.id} className="p-1 text-center font-normal text-muted-foreground min-w-[56px]">
                    <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                      {shortName(u.full_name)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((from, i) => (
                <tr key={from.id}>
                  <td className="p-1 text-muted-foreground whitespace-nowrap">{shortName(from.full_name)}</td>
                  {users.map((to, j) => {
                    if (i >= j) {
                      return <td key={to.id} className="p-0.5"><div className="w-12 h-10 rounded-sm bg-muted/30" /></td>;
                    }
                    const c = getCell(from.id, to.id);
                    return (
                      <td key={to.id} className="p-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-12 h-10 rounded-sm flex items-center justify-center border border-border/50 cursor-default hover:bg-muted/40 transition-colors">
                              {cellBadge(c)}
                            </div>
                          </TooltipTrigger>
                          {c && (c.positive + c.negative > 0) && (
                            <TooltipContent>
                              <p className="font-medium">{from.full_name} ↔ {to.full_name}</p>
                              <p className="text-positive">Позитивных: {c.positive}</p>
                              <p className="text-negative">Негативных: {c.negative}</p>
                              <p>Всего: {c.positive + c.negative}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
