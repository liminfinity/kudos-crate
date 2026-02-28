import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Edge {
  source: string;
  target: string;
  sentiment: 'positive' | 'negative' | 'mixed';
  positiveCount: number;
  negativeCount: number;
  total: number;
}

export function RelationshipGraph({ profiles, feedbackEdges }: Props) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const animRef = useRef<number>();

  const edges = useMemo(() => {
    const edgeMap: Record<string, { positive: number; negative: number }> = {};
    feedbackEdges.forEach(e => {
      const key = [e.from, e.to].sort().join('|');
      if (!edgeMap[key]) edgeMap[key] = { positive: 0, negative: 0 };
      if (e.sentiment === 'positive') edgeMap[key].positive++;
      else edgeMap[key].negative++;
    });

    return Object.entries(edgeMap)
      .map(([key, counts]) => {
        const [source, target] = key.split('|');
        const total = counts.positive + counts.negative;
        const sentiment: 'positive' | 'negative' | 'mixed' =
          counts.positive > 0 && counts.negative > 0 ? 'mixed' :
          counts.positive > 0 ? 'positive' : 'negative';
        return { source, target, sentiment, positiveCount: counts.positive, negativeCount: counts.negative, total };
      })
      .filter(e => {
        if (sentimentFilter === 'positive') return e.positiveCount > 0;
        if (sentimentFilter === 'negative') return e.negativeCount > 0;
        return true;
      });
  }, [feedbackEdges, sentimentFilter]);

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
    setHoveredEdge(edge);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const edgeColor = (e: Edge) => {
    if (e.sentiment === 'positive') return 'hsl(152, 56%, 40%)';
    if (e.sentiment === 'negative') return 'hsl(4, 76%, 56%)';
    return 'hsl(280, 60%, 55%)'; // purple for mixed
  };

  const edgeWidth = (e: Edge) => Math.max(1.5, (e.total / maxTotal) * 6);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base">Граф отношений</CardTitle>
          <div className="flex items-center gap-2">
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
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded" style={{ background: 'hsl(152, 56%, 40%)' }} /> Позитивный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded" style={{ background: 'hsl(4, 76%, 56%)' }} /> Негативный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 rounded" style={{ background: 'hsl(280, 60%, 55%)' }} /> Смешанный</span>
          <span className="text-[10px]">Толщина = сила связи</span>
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
                strokeOpacity={hoveredEdge === e ? 1 : 0.6}
                className="cursor-pointer"
                onMouseMove={ev => handleEdgeHover(ev, e)}
                onMouseLeave={() => setHoveredEdge(null)}
              />
            );
          })}
          {nodes.map(n => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={18} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} opacity={0.9} />
              <text x={n.x} y={n.y + 30} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" className="pointer-events-none select-none">
                {n.label.length > 14 ? n.label.slice(0, 12) + '…' : n.label}
              </text>
              <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={8} fill="hsl(var(--primary-foreground))" className="pointer-events-none select-none font-medium">
                {n.label.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
              </text>
            </g>
          ))}
        </svg>

        {hoveredEdge && (
          <div className="fixed z-50 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
            style={{ left: tooltipPos.x + 10, top: tooltipPos.y - 40 }}>
            <p className="font-medium">{profileMap[hoveredEdge.source]?.full_name || '?'} ↔ {profileMap[hoveredEdge.target]?.full_name || '?'}</p>
            <p className="text-positive">Позитивных: {hoveredEdge.positiveCount}</p>
            <p className="text-negative">Негативных: {hoveredEdge.negativeCount}</p>
            <p>Всего: {hoveredEdge.total} | Баланс: {hoveredEdge.positiveCount - hoveredEdge.negativeCount > 0 ? '+' : ''}{hoveredEdge.positiveCount - hoveredEdge.negativeCount}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
