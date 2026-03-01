import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Profile } from '@/lib/supabase-types';

interface FeedbackEdge { from: string; to: string; sentiment: string; created_at?: string; }
interface Props { profiles: Profile[]; feedbackEdges: FeedbackEdge[]; }
interface Node { id: string; label: string; x: number; y: number; vx: number; vy: number; }
interface Edge { source: string; target: string; sentiment: 'positive' | 'negative' | 'mixed'; positiveCount: number; negativeCount: number; total: number; firstDate?: string; lastDate?: string; }
interface NodeStats { positive: number; negative: number; total: number; }

export function RelationshipGraph({ profiles, feedbackEdges }: Props) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const animRef = useRef<number>();

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
        const sentiment: 'positive' | 'negative' | 'mixed' = counts.positive > 0 && counts.negative > 0 ? 'mixed' : counts.positive > 0 ? 'positive' : 'negative';
        const sorted = counts.dates.sort();
        return { source, target, sentiment, positiveCount: counts.positive, negativeCount: counts.negative, total, firstDate: sorted[0], lastDate: sorted[sorted.length - 1] };
      })
      .filter(e => {
        if (sentimentFilter === 'positive') return e.positiveCount > 0;
        if (sentimentFilter === 'negative') return e.negativeCount > 0;
        return true;
      });
  }, [feedbackEdges, sentimentFilter]);

  const nodeStats = useMemo(() => {
    const stats: Record<string, NodeStats> = {};
    feedbackEdges.forEach(e => {
      [e.from, e.to].forEach(id => { if (!stats[id]) stats[id] = { positive: 0, negative: 0, total: 0 }; });
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
    profiles.forEach(p => ids.add(p.id));
    return ids;
  }, [edges, profiles]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.id] = p; });
    return m;
  }, [profiles]);

  useEffect(() => {
    const W = 600, H = 400;
    const arr = Array.from(involvedIds).map((id, i) => {
      const angle = (2 * Math.PI * i) / involvedIds.size;
      const r = Math.min(W, H) * 0.35;
      return { id, label: profileMap[id]?.full_name || id.slice(0, 8), x: W / 2 + r * Math.cos(angle), y: H / 2 + r * Math.sin(angle), vx: 0, vy: 0 };
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
  }, [nodes.length, edges]);

  const nodeMap = useMemo(() => {
    const m: Record<string, Node> = {};
    nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [nodes]);

  const handleEdgeHover = useCallback((e: React.MouseEvent, edge: Edge) => {
    setHoveredEdge(edge); setHoveredNode(null); setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);
  const handleNodeHover = useCallback((e: React.MouseEvent, nodeId: string) => {
    setHoveredNode(nodeId); setHoveredEdge(null); setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const edgeColor = (e: Edge) => {
    const score = e.total > 0 ? (e.positiveCount - e.negativeCount) / e.total : 0;
    if (score > 0.2) return 'hsl(var(--positive))';
    if (score < -0.2) return 'hsl(var(--negative))';
    return 'hsl(var(--muted-foreground))';
  };

  const nodeColor = (id: string) => {
    const s = nodeStats[id];
    if (!s || s.total === 0) return 'hsl(var(--muted-foreground))';
    if (s.positive > s.negative) return 'hsl(var(--positive))';
    if (s.negative > s.positive) return 'hsl(var(--negative))';
    return 'hsl(var(--muted-foreground))';
  };

  const edgeWidth = (e: Edge) => Math.max(1, (e.total / maxTotal) * 4);
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Граф отношений</CardTitle>
          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="w-32 h-7 text-[10px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="positive">Позитивные</SelectItem>
              <SelectItem value="negative">Негативные</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-positive" /> Позитивный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-negative" /> Негативный</span>
          <span>Толщина = сила связи</span>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <svg ref={svgRef} viewBox="0 0 600 400" className="w-full h-auto rounded-lg bg-muted/30" style={{ maxHeight: 400 }}>
          {edges.map((e, i) => {
            const a = nodeMap[e.source], b = nodeMap[e.target];
            if (!a || !b) return null;
            return (
              <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={edgeColor(e)} strokeWidth={edgeWidth(e)}
                strokeOpacity={hoveredEdge === e ? 0.9 : 0.5}
                className="cursor-pointer transition-opacity duration-150"
                onMouseMove={ev => handleEdgeHover(ev, e)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
            );
          })}
          {nodes.map(n => (
            <g key={n.id}
              onMouseMove={ev => handleNodeHover(ev, n.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle cx={n.x} cy={n.y} r={16} fill="hsl(var(--card))" stroke={nodeColor(n.id)} strokeWidth={1.5} />
              <text x={n.x} y={n.y + 28} textAnchor="middle" fontSize={8} fill="hsl(var(--muted-foreground))" className="pointer-events-none select-none">
                {n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label}
              </text>
              <text x={n.x} y={n.y + 3.5} textAnchor="middle" fontSize={8} fill="hsl(var(--foreground))" className="pointer-events-none select-none font-medium">
                {n.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </text>
            </g>
          ))}
        </svg>

        {hoveredEdge && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-card-hover px-3 py-2 text-[10px] pointer-events-none"
            style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}>
            <p className="font-medium text-xs">{profileMap[hoveredEdge.source]?.full_name || '?'} ↔ {profileMap[hoveredEdge.target]?.full_name || '?'}</p>
            <p className="text-positive">Позитивных: {hoveredEdge.positiveCount}</p>
            <p className="text-negative">Негативных: {hoveredEdge.negativeCount}</p>
            <p>Всего: {hoveredEdge.total}</p>
            <p className="text-muted-foreground">{formatDate(hoveredEdge.firstDate)} — {formatDate(hoveredEdge.lastDate)}</p>
          </div>
        )}

        {hoveredNode && nodeStats[hoveredNode] && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-card-hover px-3 py-2 text-[10px] pointer-events-none"
            style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}>
            <p className="font-medium text-xs">{profileMap[hoveredNode]?.full_name || '?'}</p>
            <p className="text-positive">Позитивных: {nodeStats[hoveredNode].positive}</p>
            <p className="text-negative">Негативных: {nodeStats[hoveredNode].negative}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
