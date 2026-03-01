import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, ArrowUpDown, RotateCcw } from 'lucide-react';
import type { Profile, Team } from '@/lib/supabase-types';

interface RecipientRow {
  userId: string;
  name: string;
  total: number;
  positive: number;
  negative: number;
  topSubcats: string[];
}

type SortField = 'total' | 'positive' | 'negative' | 'balance';
type TopLimit = '20' | '50' | 'all';

interface Props {
  recipientsTable: RecipientRow[];
  profileMap: Record<string, Profile>;
  teams: Team[];
}

export function RecipientsAggregateTable({ recipientsTable, profileMap, teams }: Props) {
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortAsc, setSortAsc] = useState(false);
  const [topLimit, setTopLimit] = useState<TopLimit>('20');

  const filtered = useMemo(() => {
    let result = recipientsTable.filter(r => {
      if (search) {
        const q = search.toLowerCase();
        const prof = profileMap[r.userId];
        if (!r.name.toLowerCase().includes(q) && !(prof?.email?.toLowerCase().includes(q))) return false;
      }
      if (teamFilter !== 'all') {
        const prof = profileMap[r.userId];
        if (!prof || prof.team_id !== teamFilter) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let va: number, vb: number;
      switch (sortField) {
        case 'positive': va = a.positive; vb = b.positive; break;
        case 'negative': va = a.negative; vb = b.negative; break;
        case 'balance': va = a.positive - a.negative; vb = b.positive - b.negative; break;
        default: va = a.total; vb = b.total;
      }
      return sortAsc ? va - vb : vb - va;
    });

    if (topLimit !== 'all') {
      result = result.slice(0, Number(topLimit));
    }
    return result;
  }, [recipientsTable, search, teamFilter, sortField, sortAsc, topLimit, profileMap]);

  const hasFilters = search || teamFilter !== 'all' || sortField !== 'total' || topLimit !== '20';

  function resetFilters() {
    setSearch('');
    setTeamFilter('all');
    setSortField('total');
    setSortAsc(false);
    setTopLimit('20');
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Получатели (агрегат)</CardTitle>
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
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по имени..."
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Команда" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все команды</SelectItem>
              {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortField} onValueChange={v => setSortField(v as SortField)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="total">По кол-ву отзывов</SelectItem>
              <SelectItem value="positive">По % позитивных</SelectItem>
              <SelectItem value="negative">По % негативных</SelectItem>
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

        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('total')}>
                  Всего {sortField === 'total' && <ArrowUpDown size={10} className="inline ml-0.5" />}
                </TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('positive')}>
                  Позитивных {sortField === 'positive' && <ArrowUpDown size={10} className="inline ml-0.5" />}
                </TableHead>
                <TableHead className="text-center cursor-pointer select-none" onClick={() => toggleSort('negative')}>
                  Негативных {sortField === 'negative' && <ArrowUpDown size={10} className="inline ml-0.5" />}
                </TableHead>
                <TableHead>Топ подкатегории</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-center">{r.total}</TableCell>
                  <TableCell className="text-center text-positive font-medium">{r.positive}</TableCell>
                  <TableCell className="text-center text-negative font-medium">{r.negative}</TableCell>
                  <TableCell><div className="flex gap-1 flex-wrap">{r.topSubcats.map(s => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}</div></TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет данных</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-[10px] text-muted-foreground text-right">
          Показано: {filtered.length} из {recipientsTable.length}
        </p>
      </CardContent>
    </Card>
  );
}
