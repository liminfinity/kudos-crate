import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/supabase-types';

interface FeedbackEdge {
  from: string;
  to: string;
  sentiment: string;
  created_at?: string;
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

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  teamId?: string | null;
}

interface Edge {
  source: string;
  target: string;
  sentiment: 'positive' | 'negative' | 'mixed';
  positiveCount: number;
  negativeCount: number;
  total: number;
  firstDate?: string;
  lastDate?: string;
  isExternal?: boolean;
}

interface NodeStats {
  positive: number;
  negative: number;
  total: number;
}

export function RelationshipGraph({ profiles, feedbackEdges, teams = [] }: Props) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const animRef = useRef<number>();

  const hasTeamFilter = selectedTeams.length > 0;

  const filteredProfileIds = useMemo(() => {
    if (!hasTeamFilter) return null;
    return new Set(profiles.filter(p => p.team_id && selectedTeams.includes(p.team_id)).map(p => p.id));
  }, [profiles, selectedTeams, hasTeamFilter]);

  const edges = useMemo(() => {
    const edgeMap: Record<string, { positive: number; negative: number; dates: string[] }> = {};
    feedbackEdges.forEach(e => {
      const key = [e.from, e.to].sort().join('|');
      if (!edgeMap[key]) edgeMap[key] = { positive: 0, negative: 0, dates: [] };
      if (e.sentiment === 'positive') edgeMap[key].positive++;
      else edgeMap[key].negative++;
      if (e.created_at) edgeMap[key].dates.push(e.created_at);
    });

    return Object.entries(edgeMap)
      .map(([key, counts]) => {
        const [source, target] = key.split('|');
        const total = counts.positive + counts.negative;
        const sentiment: 'positive' | 'negative' | 'mixed' =
          counts.positive > 0 && counts.negative > 0 ? 'mixed' :
          counts.positive > 0 ? 'positive' : 'negative';
        const sorted = counts.dates.sort();
        const isExternal = hasTeamFilter && filteredProfileIds
          ? !(filteredProfileIds.has(source) && filteredProfileIds.has(target))
          : false;
        return { source, target, sentiment, positiveCount: counts.positive, negativeCount: counts.negative, total, firstDate: sorted[0], lastDate: sorted[sorted.length - 1], isExternal };
      })
      .filter(e => {
        if (sentimentFilter === 'positive') return e.positiveCount > 0;
        if (sentimentFilter === 'negative') return e.negativeCount > 0;
        return true;
      })
      .filter(e => {
        if (!hasTeamFilter || !filteredProfileIds) return true;
        return filteredProfileIds.has(e.source) || filteredProfileIds.has(e.target);
      });
  }, [feedbackEdges, sentimentFilter, hasTeamFilter, filteredProfileIds]);

  const nodeStats = useMemo(() => {
    const stats: Record<string, NodeStats> = {};
    feedbackEdges.forEach(e => {
      [e.from, e.to].forEach(id => {
        if (!stats[id]) stats[id] = { positive: 0, negative: 0, total: 0 };
      });
      if (e.sentiment === 'positive') { stats[e.from].positive++; stats[e.to].positive++; }
      else { stats[e.from].negative++; stats[e.to].negative++; }
      stats[e.from].total++; stats[e.to].total++;
    });
    return stats;
  }, [feedbackEdges]);

  const maxTotal = useMemo(() => Math.max(1, ...edges.map(e => e.total)), [edges]);

  const involvedIds = useMemo(() => {
    const ids = new Set<string>();
    edges.forEach(e => { ids.add(e.source); ids.add(e.target); });
    return ids;
  }, [edges]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  // Team color map
  const teamColorMap = useMemo(() => {
    const colors = [
      'hsl(215, 55%, 32%)', 'hsl(160, 35%, 38%)', 'hsl(4, 60%, 48%)',
      'hsl(35, 50%, 48%)', 'hsl(280, 30%, 45%)', 'hsl(190, 40%, 40%)',
    ];
    const m: Record<string, string> = {};
    teams.forEach((t, i) => { m[t.id] = colors[i % colors.length]; });
    return m;
  }, [teams]);

  useEffect(() => {
    const W = 600, H = 400;
    const arr = Array.from(involvedIds).map((id, i) => {
      const angle = (2 * Math.PI * i) / involvedIds.size;
      const r = Math.min(W, H) * 0.35;
      const p = profileMap[id];
      return { id, label: p?.full_name || id.slice(0, 8), x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle), vx: 0, vy: 0, teamId: p?.team_id };
    });
    setNodes(arr);
  }, [involvedIds, profileMap]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const W = 600, H = 400;
    let running = true;
    let iter = 0;
    const maxIter = 150;

    const tick = () => {
      if (!running || iter >= maxIter) return;
      iter++;
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));
        const nm: Record<string, typeof next[0]> = {};
        next.forEach(n => { nm[n.id] = n; });

        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x, dy = next[j].y - next[i].y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
            const force = 3000 / (dist * dist);
            const fx = (dx / dist) * force, fy = (dy / dist) * force;
            next[i].vx -= fx; next[i].vy -= fy;
            next[j].vx += fx; next[j].vy += fy;
          }
        }

        edges.forEach(e => {
          const a = nm[e.source], b = nm[e.target];
          if (!a || !b) return;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (dist - 120) * 0.01;
          const fx = (dx / dist) * force, fy = (dy / dist) * force;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        });

        // Team clustering force
        if (hasTeamFilter && selectedTeams.length > 1) {
          const teamCenters: Record<string, { x: number; y: number; count: number }> = {};
          next.forEach(n => {
            if (n.teamId && selectedTeams.includes(n.teamId)) {
              if (!teamCenters[n.teamId]) teamCenters[n.teamId] = { x: 0, y: 0, count: 0 };
              teamCenters[n.teamId].x += n.x;
              teamCenters[n.teamId].y += n.y;
              teamCenters[n.teamId].count++;
            }
          });
          Object.values(teamCenters).forEach(c => { c.x /= c.count; c.y /= c.count; });
          next.forEach(n => {
            if (n.teamId && teamCenters[n.teamId]) {
              const c = teamCenters[n.teamId];
              n.vx += (c.x - n.x) * 0.005;
              n.vy += (c.y - n.y) * 0.005;
            }
          });
        }

        next.forEach(n => {
          n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002;
          n.vx *= 0.85; n.vy *= 0.85;
          n.x += n.vx; n.y += n.vy;
          n.x = Math.max(30, Math.min(W - 30, n.x));
          n.y = Math.max(30, Math.min(H - 30, n.y));
        });
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [nodes.length, edges, hasTeamFilter, selectedTeams]);

  const nodeMap = useMemo(() => {
    const m: Record<string, Node> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const handleEdgeHover = useCallback((e: React.MouseEvent, edge: Edge) => {
    setHoveredEdge(edge); setHoveredNode(null);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleNodeHover = useCallback((e: React.MouseEvent, nodeId: string) => {
    setHoveredNode(nodeId); setHoveredEdge(null);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const edgeColor = (e: Edge) => {
    const score = e.total > 0 ? (e.positiveCount - e.negativeCount) / e.total : 0;
    const absScore = Math.abs(score);
    const hue = score >= 0 ? 120 : 0;
    const saturation = Math.round(absScore * 80);
    return `hsl(${hue}, ${saturation}%, 45%)`;
  };

  const nodeColor = (id: string) => {
    if (hasTeamFilter && filteredProfileIds && !filteredProfileIds.has(id)) return 'hsl(var(--muted-foreground))';
    const p = profileMap[id];
    if (hasTeamFilter && p?.team_id && teamColorMap[p.team_id]) return teamColorMap[p.team_id];
    const s = nodeStats[id];
    if (!s || s.total === 0) return 'hsl(var(--muted-foreground))';
    if (s.positive > s.negative) return 'hsl(152, 56%, 40%)';
    if (s.negative > s.positive) return 'hsl(4, 76%, 56%)';
    return 'hsl(280, 60%, 55%)';
  };

  const edgeWidth = (e: Edge) => Math.max(1.5, (e.total / maxTotal) * 6);
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

  function toggleTeam(teamId: string) {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(t => t !== teamId) : [...prev, teamId]
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Граф отношений</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs text-muted-foreground">Тип</Label>
            <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="positive">Позитивные</SelectItem>
                <SelectItem value="negative">Негативные</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Team multi-select */}
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Label className="text-xs text-muted-foreground self-center">Команды:</Label>
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs border transition-all",
                  selectedTeams.includes(t.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted text-muted-foreground"
                )}
              >
                {t.name}
              </button>
            ))}
            {selectedTeams.length > 0 && (
              <button onClick={() => setSelectedTeams([])} className="text-[10px] text-accent hover:underline self-center ml-1">
                Сбросить
              </button>
            )}
          </div>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(152, 56%, 40%)' }} /> Позитивный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(4, 76%, 56%)' }} /> Негативный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(280, 60%, 55%)' }} /> Смешанный</span>
          {hasTeamFilter && <span className="flex items-center gap-1">--- Внешние связи</span>}
        </div>
      </CardHeader>
      <CardContent className="relative">
        <svg ref={svgRef} viewBox="0 0 600 400" className="w-full h-auto border rounded-lg bg-muted/20" style={{ maxHeight: 400 }}>
          {edges.map((e, i) => {
            const a = nodeMap[e.source], b = nodeMap[e.target];
            if (!a || !b) return null;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={edgeColor(e)} strokeWidth={edgeWidth(e)}
                strokeOpacity={hoveredEdge === e ? 1 : e.isExternal ? 0.3 : 0.6}
                strokeDasharray={e.isExternal ? '4 4' : undefined}
                className="cursor-pointer"
                onMouseMove={ev => handleEdgeHover(ev, e)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
            );
          })}
          {nodes.map(n => {
            const isExternal = hasTeamFilter && filteredProfileIds && !filteredProfileIds.has(n.id);
            return (
              <g key={n.id}
                onMouseMove={ev => handleNodeHover(ev, n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
                opacity={isExternal ? 0.5 : 1}
              >
                <circle cx={n.x} cy={n.y} r={isExternal ? 14 : 18} fill={nodeColor(n.id)} stroke="hsl(var(--background))" strokeWidth={2} opacity={0.9}
                  strokeDasharray={isExternal ? '3 3' : undefined} />
                <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" className="pointer-events-none select-none">
                  {n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label}
                </text>
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={8} fill="white" className="pointer-events-none select-none font-medium">
                  {n.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredEdge && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}>
            <p className="font-medium">{profileMap[hoveredEdge.source]?.full_name || '?'} ↔ {profileMap[hoveredEdge.target]?.full_name || '?'}</p>
            <p style={{ color: 'hsl(120, 60%, 40%)' }}>Позитивных: {hoveredEdge.positiveCount}</p>
            <p style={{ color: 'hsl(0, 60%, 50%)' }}>Негативных: {hoveredEdge.negativeCount}</p>
            <p>Всего: {hoveredEdge.total} | Баланс: {hoveredEdge.positiveCount - hoveredEdge.negativeCount > 0 ? '+' : ''}{hoveredEdge.positiveCount - hoveredEdge.negativeCount}</p>
            {hoveredEdge.isExternal && <p className="text-chart-4">Внешняя связь</p>}
            <p className="text-muted-foreground">Первый: {formatDate(hoveredEdge.firstDate)} · Последний: {formatDate(hoveredEdge.lastDate)}</p>
          </div>
        )}

        {hoveredNode && nodeStats[hoveredNode] && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}>
            <p className="font-medium">{profileMap[hoveredNode]?.full_name || '?'}</p>
            {profileMap[hoveredNode]?.team_id && teams.length > 0 && (
              <p className="text-muted-foreground">{teams.find(t => t.id === profileMap[hoveredNode]?.team_id)?.name}</p>
            )}
            <p style={{ color: 'hsl(152, 56%, 40%)' }}>Позитивных: {nodeStats[hoveredNode].positive}</p>
            <p style={{ color: 'hsl(4, 76%, 56%)' }}>Негативных: {nodeStats[hoveredNode].negative}</p>
            <p>Всего: {nodeStats[hoveredNode].total}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
