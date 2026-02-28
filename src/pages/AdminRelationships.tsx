import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RelationshipGraph } from '@/features/relationships/RelationshipGraph';
import {
  useRelationshipsGraph,
  PERIOD_PRESETS,
  type RelationshipMode,
  type PeriodPreset,
} from '@/hooks/useRelationshipsGraph';

export default function AdminRelationships() {
  const [mode, setMode] = useState<RelationshipMode>('employees');
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const { nodes, edges, loading, error } = useRelationshipsGraph(mode, period);

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 animate-fade-in">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold">Отношения</h1>
            <p className="text-muted-foreground">
              Граф связей между сотрудниками и командами
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Период" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 rounded-lg border p-1">
              <Button
                variant={mode === 'employees' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('employees')}
              >
                Сотрудники
              </Button>
              <Button
                variant={mode === 'teams' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setMode('teams')}
              >
                Команды
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden rounded-xl border bg-card shadow-sm">
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center text-destructive text-sm">
              {error}
            </div>
          )}
          {!loading && !error && (
            <RelationshipGraph nodes={nodes} edges={edges} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
