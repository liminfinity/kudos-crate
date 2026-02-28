import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { GraphEdge, GraphNode } from 'reagraph';

export type RelationshipMode = 'employees' | 'teams';

export type PeriodPreset = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Все время' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: '3m', label: '3 месяца' },
  { value: '6m', label: '6 месяцев' },
  { value: '1y', label: 'Год' },
];

function getPeriodBounds(preset: PeriodPreset): { from: string; to: string } | null {
  if (preset === 'all') return null;
  const to = new Date();
  const from = new Date();
  switch (preset) {
    case '7d':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
      from.setDate(from.getDate() - 30);
      break;
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case '6m':
      from.setMonth(from.getMonth() - 6);
      break;
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      return null;
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

interface RawFeedback {
  from_user_id: string;
  to_user_id: string;
  sentiment: 'positive' | 'negative';
}

interface Profile {
  id: string;
  full_name: string;
  team_id: string | null;
}

interface Team {
  id: string;
  name: string;
}

type PairKey = `${string}->${string}`;

const POSITIVE_COLOR = '#22c55e';
const NEGATIVE_COLOR = '#ef4444';

function firstWord(name: string): string {
  return name.split(' ')[0] ?? name;
}

interface AggregatedEdge {
  source: string;
  target: string;
  positive: number;
  negative: number;
}

function buildEmployeeGraph(
  feedback: RawFeedback[],
  profiles: Profile[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const profileMap = new Map<string, Profile>(profiles.map((p) => [p.id, p]));

  const agg = new Map<PairKey, AggregatedEdge>();
  const involvedIds = new Set<string>();

  for (const f of feedback) {
    if (f.from_user_id === f.to_user_id) continue;
    const key: PairKey = `${f.from_user_id}->${f.to_user_id}`;
    let e = agg.get(key);
    if (!e) {
      e = { source: f.from_user_id, target: f.to_user_id, positive: 0, negative: 0 };
      agg.set(key, e);
    }
    if (f.sentiment === 'positive') e.positive += 1;
    else e.negative += 1;
    involvedIds.add(f.from_user_id);
    involvedIds.add(f.to_user_id);
  }

  const incomingPos = new Map<string, number>();
  const incomingNeg = new Map<string, number>();
  for (const e of agg.values()) {
    const pos = incomingPos.get(e.target) ?? 0;
    const neg = incomingNeg.get(e.target) ?? 0;
    incomingPos.set(e.target, pos + e.positive);
    incomingNeg.set(e.target, neg + e.negative);
  }

  const nodes: GraphNode[] = [];
  for (const id of involvedIds) {
    const profile = profileMap.get(id);
    const pos = incomingPos.get(id) ?? 0;
    const neg = incomingNeg.get(id) ?? 0;
    const showWarning = neg > pos;
    nodes.push({
      id,
      label: profile ? firstWord(profile.full_name) : id.slice(0, 8),
      ...(showWarning && { subLabel: '⚠' }),
    });
  }

  const edges: GraphEdge[] = [];
  for (const e of agg.values()) {
    const isPositive = e.positive >= e.negative;
    const label = `${e.positive}/${e.negative}`;
    edges.push({
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      label,
      fill: isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR,
    });
  }

  return { nodes, edges };
}

function buildTeamGraph(
  feedback: RawFeedback[],
  profiles: Profile[],
  teams: Team[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const profileMap = new Map<string, Profile>(profiles.map((p) => [p.id, p]));
  const teamMap = new Map<string, Team>(teams.map((t) => [t.id, t]));

  const agg = new Map<PairKey, AggregatedEdge>();
  const involvedTeamIds = new Set<string>();

  for (const f of feedback) {
    const fromTeam = profileMap.get(f.from_user_id)?.team_id;
    const toTeam = profileMap.get(f.to_user_id)?.team_id;
    if (!fromTeam || !toTeam || fromTeam === toTeam) continue;
    const key: PairKey = `${fromTeam}->${toTeam}`;
    let e = agg.get(key);
    if (!e) {
      e = { source: fromTeam, target: toTeam, positive: 0, negative: 0 };
      agg.set(key, e);
    }
    if (f.sentiment === 'positive') e.positive += 1;
    else e.negative += 1;
    involvedTeamIds.add(fromTeam);
    involvedTeamIds.add(toTeam);
  }

  const incomingPos = new Map<string, number>();
  const incomingNeg = new Map<string, number>();
  for (const e of agg.values()) {
    const pos = incomingPos.get(e.target) ?? 0;
    const neg = incomingNeg.get(e.target) ?? 0;
    incomingPos.set(e.target, pos + e.positive);
    incomingNeg.set(e.target, neg + e.negative);
  }

  const nodes: GraphNode[] = [];
  for (const id of involvedTeamIds) {
    const team = teamMap.get(id);
    const pos = incomingPos.get(id) ?? 0;
    const neg = incomingNeg.get(id) ?? 0;
    const showWarning = neg > pos;
    nodes.push({
      id,
      label: team?.name ?? id.slice(0, 8),
      ...(showWarning && { subLabel: '⚠' }),
    });
  }

  const edges: GraphEdge[] = [];
  for (const e of agg.values()) {
    const isPositive = e.positive >= e.negative;
    const label = `${e.positive}/${e.negative}`;
    edges.push({
      id: `${e.source}->${e.target}`,
      source: e.source,
      target: e.target,
      label,
      fill: isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR,
    });
  }

  return { nodes, edges };
}

interface UseRelationshipsGraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  error: string | null;
}

export function useRelationshipsGraph(
  mode: RelationshipMode,
  periodPreset: PeriodPreset,
): UseRelationshipsGraphResult {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const bounds = getPeriodBounds(periodPreset);
      let feedbackQuery = supabase
        .from('feedback')
        .select('from_user_id, to_user_id, sentiment, created_at');

      if (bounds) {
        feedbackQuery = feedbackQuery
          .gte('created_at', bounds.from)
          .lte('created_at', bounds.to);
      }

      const [feedbackRes, profilesRes, teamsRes] = await Promise.all([
        feedbackQuery,
        supabase.from('profiles').select('id, full_name, team_id'),
        supabase.from('teams').select('id, name'),
      ]);

      if (cancelled) return;

      if (feedbackRes.error || profilesRes.error || teamsRes.error) {
        setError('Ошибка загрузки данных');
        setLoading(false);
        return;
      }

      const feedback = (feedbackRes.data ?? []) as RawFeedback[];
      const profiles = (profilesRes.data ?? []) as Profile[];
      const teams = (teamsRes.data ?? []) as Team[];

      const graph =
        mode === 'employees'
          ? buildEmployeeGraph(feedback, profiles)
          : buildTeamGraph(feedback, profiles, teams);

      setNodes(graph.nodes);
      setEdges(graph.edges);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mode, periodPreset]);

  return { nodes, edges, loading, error };
}
