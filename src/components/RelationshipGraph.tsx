import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, X } from 'lucide-react';
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

const W = 600, H = 400;
const MIN_ZOOM = 0.3, MAX_ZOOM = 3.0;

export function RelationshipGraph({ profiles, feedbackEdges, teams = [] }: Props) {
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Edge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [nodes, setNodes] = useState<Node[]>([]);
  const animRef = useRef<number>();

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // Focus state
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

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

  const teamColorMap = useMemo(() => {
    const colors = [
      'hsl(215, 55%, 32%)', 'hsl(160, 35%, 38%)', 'hsl(4, 60%, 48%)',
      'hsl(35, 50%, 48%)', 'hsl(280, 30%, 45%)', 'hsl(190, 40%, 40%)',
    ];
    const m: Record<string, string> = {};
    teams.forEach((t, i) => { m[t.id] = colors[i % colors.length]; });
    return m;
  }, [teams]);

  // Focus: neighbors
  const focusNeighbors = useMemo(() => {
    if (!focusedNode) return null;
    const neighbors = new Set<string>();
    neighbors.add(focusedNode);
    edges.forEach(e => {
      if (e.source === focusedNode) neighbors.add(e.target);
      if (e.target === focusedNode) neighbors.add(e.source);
    });
    return neighbors;
  }, [focusedNode, edges]);

  const focusSummary = useMemo(() => {
    if (!focusedNode) return null;
    let pos = 0, neg = 0, connections = 0;
    edges.forEach(e => {
      if (e.source === focusedNode || e.target === focusedNode) {
        connections++;
        pos += e.positiveCount;
        neg += e.negativeCount;
      }
    });
    return { connections, pos, neg, total: pos + neg };
  }, [focusedNode, edges]);

  useEffect(() => {
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

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only pan if not clicking a node
    const target = e.target as SVGElement;
    if (target.closest('.graph-node')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const fitToScreen = useCallback(() => {
    if (nodes.length === 0) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    const pw = maxX - minX + 80, ph = maxY - minY + 80;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(W / pw, H / ph)));
    setZoom(newZoom);
    setPan({ x: 0, y: 0 });
  }, [nodes]);

  const handleEdgeHover = useCallback((e: React.MouseEvent, edge: Edge) => {
    setHoveredEdge(edge); setHoveredNode(null);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleNodeHover = useCallback((e: React.MouseEvent, nodeId: string) => {
    setHoveredNode(nodeId); setHoveredEdge(null);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setFocusedNode(prev => prev === nodeId ? null : nodeId);
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

  // Visibility helpers for focus mode
  const isEdgeVisible = (e: Edge) => {
    if (!focusNeighbors) return true;
    return e.source === focusedNode || e.target === focusedNode;
  };

  const isNodeVisible = (id: string) => {
    if (!focusNeighbors) return true;
    return focusNeighbors.has(id);
  };

  const transform = `translate(${pan.x}, ${pan.y}) scale(${zoom})`;
  const transformOrigin = `${W / 2}px ${H / 2}px`;

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
        {teams.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Label className="text-xs text-muted-foreground self-center">Команды:</Label>
            {teams.map(t => (
              <button key={t.id} onClick={() => toggleTeam(t.id)}
                className={cn("px-2.5 py-1 rounded-full text-xs border transition-all",
                  selectedTeams.includes(t.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted text-muted-foreground"
                )}>
                {t.name}
              </button>
            ))}
            {selectedTeams.length > 0 && (
              <button onClick={() => setSelectedTeams([])} className="text-[10px] text-accent hover:underline self-center ml-1">Сбросить</button>
            )}
          </div>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(152, 56%, 40%)' }} /> Позитивный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(4, 76%, 56%)' }} /> Негативный</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: 'hsl(280, 60%, 55%)' }} /> Смешанный</span>
          {hasTeamFilter && <span className="flex items-center gap-1">--- Внешние связи</span>}
          {focusedNode && <span className="text-primary font-medium">🔍 Фокус: {profileMap[focusedNode]?.full_name}</span>}
        </div>
      </CardHeader>
      <CardContent className="relative">
        {/* Zoom/Pan controls */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.3))} title="Приблизить">
            <ZoomIn size={14} />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.7))} title="Отдалить">
            <ZoomOut size={14} />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={fitToScreen} title="Вписать">
            <Maximize size={14} />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={resetView} title="Сброс">
            <RotateCcw size={14} />
          </Button>
          {focusedNode && (
            <Button variant="outline" size="icon" className="h-7 w-7 border-primary text-primary" onClick={() => setFocusedNode(null)} title="Сбросить фокус">
              <X size={14} />
            </Button>
          )}
        </div>

        {/* Zoom level indicator */}
        <div className="absolute bottom-2 left-2 z-10 text-[10px] text-muted-foreground bg-background/80 rounded px-1.5 py-0.5">
          {Math.round(zoom * 100)}%
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto border rounded-lg bg-muted/20 select-none"
          style={{ maxHeight: 500, cursor: isPanning.current ? 'grabbing' : 'grab' }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={transform} style={{ transformOrigin }}>
            {edges.map((e, i) => {
              const a = nodeMap[e.source], b = nodeMap[e.target];
              if (!a || !b) return null;
              const visible = isEdgeVisible(e);
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={edgeColor(e)} strokeWidth={edgeWidth(e)}
                  strokeOpacity={!visible ? 0.06 : hoveredEdge === e ? 1 : e.isExternal ? 0.3 : 0.6}
                  strokeDasharray={e.isExternal ? '4 4' : undefined}
                  className="cursor-pointer"
                  style={{ transition: 'stroke-opacity 0.2s' }}
                  onMouseMove={visible ? ev => handleEdgeHover(ev, e) : undefined}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              );
            })}
            {nodes.map(n => {
              const isExternal = hasTeamFilter && filteredProfileIds && !filteredProfileIds.has(n.id);
              const visible = isNodeVisible(n.id);
              const isFocused = focusedNode === n.id;
              return (
                <g key={n.id}
                  className="graph-node cursor-pointer"
                  onMouseMove={visible ? ev => handleNodeHover(ev, n.id) : undefined}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(n.id)}
                  opacity={!visible ? 0.08 : isExternal ? 0.5 : 1}
                  style={{ transition: 'opacity 0.2s' }}
                >
                  <circle cx={n.x} cy={n.y} r={isExternal ? 14 : 18} fill={nodeColor(n.id)} stroke={isFocused ? 'hsl(var(--primary))' : 'hsl(var(--background))'} strokeWidth={isFocused ? 3 : 2} opacity={0.9}
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
          </g>
        </svg>

        {/* Focus summary panel */}
        {focusedNode && focusSummary && (
          <div className="mt-3 p-3 rounded-lg border bg-muted/30 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{profileMap[focusedNode]?.full_name}</span>
              <button onClick={() => setFocusedNode(null)} className="text-xs text-muted-foreground hover:text-foreground">Сбросить фокус</button>
            </div>
            <div className="flex gap-4 text-xs">
              <span>Связей: <strong>{focusSummary.connections}</strong></span>
              <span style={{ color: 'hsl(152, 56%, 40%)' }}>Позитивных: <strong>{focusSummary.pos}</strong></span>
              <span style={{ color: 'hsl(4, 76%, 56%)' }}>Негативных: <strong>{focusSummary.neg}</strong></span>
              <span>Всего: <strong>{focusSummary.total}</strong></span>
            </div>
          </div>
        )}

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
            <p className="text-muted-foreground mt-1">Клик — фокус на связях</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
