import { useRef } from 'react';
import { GraphCanvas, GraphCanvasRef, lightTheme } from 'reagraph';
import type { GraphEdge, GraphNode } from 'reagraph';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const WARNING_COLOR = '#f59e0b';

const theme = {
  ...lightTheme,
  node: {
    ...lightTheme.node,
    subLabel: {
      color: WARNING_COLOR,
      stroke: WARNING_COLOR,
      activeColor: WARNING_COLOR,
    },
  },
  edge: {
    ...lightTheme.edge,
    label: {
      ...lightTheme.edge.label,
      fontSize: 5,
    },
  },
};

export function RelationshipGraph({ nodes, edges }: RelationshipGraphProps) {
  const ref = useRef<GraphCanvasRef | null>(null);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Нет данных для отображения
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <GraphCanvas
        ref={ref}
        nodes={nodes}
        edges={edges}
        layoutType="forceDirected2d"
        defaultNodeSize={14}
        labelType="nodes"
        edgeLabelPosition="inline"
        edgeInterpolation="curved"
        animated
        theme={theme}
        cameraMode="pan"
        draggable
        aggregateEdges={false}
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 rounded-lg border bg-background/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-[#22c55e]" />
          <span className="text-muted-foreground">Больше позитивных</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-[#ef4444]" />
          <span className="text-muted-foreground">Больше негативных</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5 border-t mt-0.5">
          <span style={{ color: WARNING_COLOR }}>⚠</span>
          <span className="text-muted-foreground">Много негативных отзывов</span>
        </div>
      </div>

      {/* Camera controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
          onClick={() => ref.current?.zoomIn()}
          aria-label="Увеличить"
        >
          <ZoomIn size={14} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
          onClick={() => ref.current?.zoomOut()}
          aria-label="Уменьшить"
        >
          <ZoomOut size={14} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 bg-background/90 backdrop-blur-sm shadow-sm"
          onClick={() => ref.current?.fitNodesInView()}
          aria-label="Сбросить вид"
        >
          <Maximize2 size={14} />
        </Button>
      </div>
    </div>
  );
}
