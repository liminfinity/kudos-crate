import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

interface FeedbackEdge {
  from: string;
  to: string;
  sentiment: string;
}

interface Team {
  id: string;
  name: string;
}

interface Props {
  profiles: Profile[];
  feedbackEdges: FeedbackEdge[];
  teams?: Team[];
}

const MAX_HEATMAP_USERS = 35;

export function InteractionHeatmap({ profiles, feedbackEdges, teams = [] }: Props) {
  const [search, setSearch] = useState('');
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const [showPanel, setShowPanel] = useState(false);
  const [teamFilter, setTeamFilter] = useState('none'); // default: no team selected
  const [linkFilter, setLinkFilter] = useState<'all' | 'active' | 'negative'>('all');

  const allUsers = useMemo(() => {
    const userIds = new Set<string>();
    feedbackEdges.forEach(e => { userIds.add(e.from); userIds.add(e.to); });
    return profiles.filter(p => userIds.has(p.id));
  }, [profiles, feedbackEdges]);

  const filteredBySearch = useMemo(() =>
    allUsers.filter(u => u.full_name.toLowerCase().includes(search.toLowerCase())),
    [allUsers, search]
  );

  const visibleUsers = useMemo(() => {
    if (teamFilter === 'none') return [];
    return allUsers.filter(u => {
      if (hiddenUsers.has(u.id)) return false;
      if (teamFilter !== 'all' && u.team_id !== teamFilter) return false;
      return true;
    });
  }, [allUsers, hiddenUsers, teamFilter]);

  const isTruncated = visibleUsers.length > MAX_HEATMAP_USERS;
  const displayUsers = isTruncated ? visibleUsers.slice(0, MAX_HEATMAP_USERS) : visibleUsers;

  const { matrix } = useMemo(() => {
    const matrix: Record<string, Record<string, { positive: number; negative: number }>> = {};
    displayUsers.forEach(u => {
      matrix[u.id] = {};
      displayUsers.forEach(v => {
        matrix[u.id][v.id] = { positive: 0, negative: 0 };
      });
    });
    const visibleIds = new Set(displayUsers.map(u => u.id));
    feedbackEdges.forEach(e => {
      if (visibleIds.has(e.from) && visibleIds.has(e.to)) {
        if (e.sentiment === 'positive') matrix[e.from][e.to].positive++;
        else matrix[e.from][e.to].negative++;
      }
    });
    return { matrix };
  }, [displayUsers, feedbackEdges]);

  const maxCount = Math.max(1, ...displayUsers.flatMap(u => displayUsers.map(v => {
    const c = matrix[u.id]?.[v.id];
    return c ? c.positive + c.negative : 0;
  })));

  function toggleUser(id: string) {
    setHiddenUsers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllInTeam() {
    setHiddenUsers(new Set());
  }

  function clearAll() {
    setHiddenUsers(new Set(allUsers.map(u => u.id)));
  }

  function cellColor(pos: number, neg: number): string {
    const total = pos + neg;
    if (total === 0) return 'transparent';
    if (linkFilter === 'negative' && neg === 0) return 'transparent';
    if (linkFilter === 'active' && total < 2) return 'transparent';
    const intensity = Math.min(total / maxCount, 1);
    const ratio = pos / total;
    if (ratio >= 0.5) return `hsla(152, 56%, 40%, ${0.15 + intensity * 0.7})`;
    return `hsla(4, 76%, 56%, ${0.15 + intensity * 0.7})`;
  }

  const shortName = (name: string) => name.length > 10 ? name.slice(0, 9) + '…' : name;

  if (allUsers.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Тепловая карта взаимодействий</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground text-sm text-center py-6">Нет данных</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Тепловая карта взаимодействий</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={teamFilter} onValueChange={v => { setTeamFilter(v); setHiddenUsers(new Set()); }}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Выберите команду" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Выберите команду —</SelectItem>
                <SelectItem value="all">Все команды</SelectItem>
                {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {/* Link filter toggles */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              {([['all', 'Все'], ['active', 'Активные'], ['negative', 'Негатив']] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setLinkFilter(val)}
                  className={cn(
                    'px-3 py-1.5 transition-colors',
                    linkFilter === val ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPanel(!showPanel)}
              className={cn("p-2 rounded-lg border transition-colors", showPanel ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              <Filter size={14} />
            </button>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'hsla(152, 56%, 40%, 0.6)' }} /> Позитивные</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: 'hsla(4, 76%, 56%, 0.6)' }} /> Негативные</span>
          {teamFilter !== 'none' && <span className="text-[10px]">Видно: {displayUsers.length}/{allUsers.length}</span>}
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden">
        {teamFilter === 'none' ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">Выберите команду, чтобы отобразить тепловую карту</p>
            <p className="text-muted-foreground text-xs mt-1">Всего сотрудников с обратной связью: {allUsers.length}</p>
          </div>
        ) : (
          <>
            {isTruncated && (
              <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-chart-4/10 border border-chart-4/30 text-xs">
                <AlertTriangle size={14} className="text-chart-4 flex-shrink-0" />
                <span>Слишком много пользователей ({visibleUsers.length}). Показаны первые {MAX_HEATMAP_USERS}. Выберите конкретную команду или сузьте список через фильтр.</span>
              </div>
            )}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* User filter panel */}
              {showPanel && (
                <div className="w-full lg:w-48 flex-shrink-0 space-y-3 lg:border-r border-b lg:border-b-0 border-border lg:pr-4 pb-4 lg:pb-0 animate-fade-in">
                  <div className="relative">
                    <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск..." className="pl-7 h-8 text-xs" />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <Label className="text-[11px] text-muted-foreground">Сотрудники</Label>
                    <div className="flex gap-1">
                      <button onClick={selectAllInTeam} className="text-[10px] text-accent hover:underline">Все</button>
                      <span className="text-[10px] text-muted-foreground">|</span>
                      <button onClick={clearAll} className="text-[10px] text-accent hover:underline">Никого</button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredBySearch.map(u => (
                      <label key={u.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/50 cursor-pointer text-xs">
                        <Checkbox
                          checked={!hiddenUsers.has(u.id)}
                          onCheckedChange={() => toggleUser(u.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span className="truncate">{u.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Heatmap */}
              <div className="flex-1 overflow-x-auto">
                <TooltipProvider delayDuration={0}>
                  <table className="border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="p-1 text-left text-muted-foreground font-normal min-w-[80px]">От \ Кому</th>
                        {displayUsers.map(u => (
                          <th key={u.id} className="p-1 text-center font-normal text-muted-foreground min-w-[48px]">
                            <span style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                              {shortName(u.full_name)}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayUsers.map(from => (
                        <tr key={from.id}>
                          <td className="p-1 text-muted-foreground whitespace-nowrap">{shortName(from.full_name)}</td>
                          {displayUsers.map(to => {
                            const c = matrix[from.id]?.[to.id] || { positive: 0, negative: 0 };
                            const total = c.positive + c.negative;
                            const isSelf = from.id === to.id;
                            return (
                              <td key={to.id} className="p-0.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="w-10 h-10 rounded-sm flex items-center justify-center text-[10px] font-medium cursor-default transition-all hover:scale-110"
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
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
