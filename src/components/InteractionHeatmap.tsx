import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function InteractionHeatmap({ profiles, feedbackEdges }: Props) {
  // Build matrix data
  const { matrix, users } = useMemo(() => {
    // Get unique users involved in feedback
    const userIds = new Set<string>();
    feedbackEdges.forEach(e => { userIds.add(e.from); userIds.add(e.to); });
    const users = profiles.filter(p => userIds.has(p.id));

    const matrix: Record<string, Record<string, { positive: number; negative: number }>> = {};
    users.forEach(u => {
      matrix[u.id] = {};
      users.forEach(v => {
        matrix[u.id][v.id] = { positive: 0, negative: 0 };
      });
    });

    feedbackEdges.forEach(e => {
      if (matrix[e.from]?.[e.to]) {
        if (e.sentiment === 'positive') matrix[e.from][e.to].positive++;
        else matrix[e.from][e.to].negative++;
      }
    });

    return { matrix, users };
  }, [profiles, feedbackEdges]);

  if (users.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Тепловая карта взаимодействий</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm text-center py-6">Нет данных</p></CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(1, ...users.flatMap(u => users.map(v => {
    const c = matrix[u.id]?.[v.id];
    return c ? c.positive + c.negative : 0;
  })));

  function cellColor(pos: number, neg: number): string {
    const total = pos + neg;
    if (total === 0) return 'transparent';
    const intensity = Math.min(total / maxCount, 1);
    const ratio = pos / total;
    // Green if mostly positive, red if mostly negative
    if (ratio >= 0.5) {
      return `hsla(152, 56%, 40%, ${0.15 + intensity * 0.7})`;
    }
    return `hsla(4, 76%, 56%, ${0.15 + intensity * 0.7})`;
  }

  const shortName = (name: string) => name.length > 10 ? name.slice(0, 9) + '…' : name;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Тепловая карта взаимодействий</CardTitle>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'hsla(152, 56%, 40%, 0.6)' }} /> Позитивные</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'hsla(4, 76%, 56%, 0.6)' }} /> Негативные</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider delayDuration={0}>
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-muted-foreground font-normal min-w-[80px]">От \ Кому</th>
                {users.map(u => (
                  <th key={u.id} className="p-1 text-center font-normal text-muted-foreground min-w-[48px]">
                    <span className="writing-mode-vertical" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                      {shortName(u.full_name)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(from => (
                <tr key={from.id}>
                  <td className="p-1 text-muted-foreground whitespace-nowrap">{shortName(from.full_name)}</td>
                  {users.map(to => {
                    const c = matrix[from.id]?.[to.id] || { positive: 0, negative: 0 };
                    const total = c.positive + c.negative;
                    const isSelf = from.id === to.id;
                    return (
                      <td key={to.id} className="p-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="w-10 h-10 rounded-sm flex items-center justify-center text-[10px] font-medium cursor-default transition-transform hover:scale-110"
                              style={{
                                background: isSelf ? 'hsl(var(--muted))' : cellColor(c.positive, c.negative),
                                color: total > 0 ? 'white' : 'transparent',
                              }}
                            >
                              {isSelf ? '—' : total > 0 ? total : ''}
                            </div>
                          </TooltipTrigger>
                          {!isSelf && total > 0 && (
                            <TooltipContent>
                              <p className="font-medium">{from.full_name} → {to.full_name}</p>
                              <p className="text-positive">Позитивных: {c.positive}</p>
                              <p className="text-negative">Негативных: {c.negative}</p>
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
