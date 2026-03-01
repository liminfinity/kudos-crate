import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Disc } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SurveyProgressSidebarProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  stepIcons?: LucideIcon[];
  onStepClick?: (step: number) => void;
  completedSteps?: Set<number>;
}

export function SurveyProgressSidebar({
  currentStep,
  totalSteps,
  stepNames,
  stepIcons,
  onStepClick,
  completedSteps,
}: SurveyProgressSidebarProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  const content = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Прогресс</span>
        <span className="text-sm font-bold text-primary">{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} className="h-2" />
      <div className="space-y-1 mt-3">
        {stepNames.map((name, i) => {
          const Icon = stepIcons?.[i];
          const isCompleted = completedSteps?.has(i) || i < currentStep;
          const isCurrent = i === currentStep;
          return (
            <button
              key={i}
              onClick={() => onStepClick?.(i)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left",
                isCurrent && "bg-primary/10 text-primary font-medium",
                isCompleted && !isCurrent && "text-positive",
                !isCompleted && !isCurrent && "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isCompleted && !isCurrent ? (
                <CheckCircle2 size={16} className="flex-shrink-0 text-positive" />
              ) : isCurrent ? (
                <Disc size={16} className="flex-shrink-0 text-primary" />
              ) : (
                <Circle size={16} className="flex-shrink-0" />
              )}
              {Icon && <Icon size={14} className="flex-shrink-0" />}
              <span className="truncate">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="mb-4 border rounded-xl bg-card p-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">Прогресс</span>
            <span className="text-xs font-bold text-primary">{progressPercent}%</span>
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {!expanded && <Progress value={progressPercent} className="h-1.5 mt-2" />}
        {expanded && <div className="mt-3">{content}</div>}
      </div>
    );
  }

  return (
    <div className="sticky top-8 w-56 flex-shrink-0">
      <div className="border rounded-xl bg-card p-4">
        {content}
      </div>
    </div>
  );
}
