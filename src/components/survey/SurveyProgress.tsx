import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface SurveyProgressProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  stepIcons?: LucideIcon[];
  onStepClick?: (step: number) => void;
  compact?: boolean;
}

export function SurveyProgress({ currentStep, totalSteps, stepNames, stepIcons, onStepClick, compact }: SurveyProgressProps) {
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="mb-5">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          Шаг {currentStep + 1} из {totalSteps}
        </span>
        <span className="text-xs font-medium text-primary">{progressPercent}%</span>
      </div>
      <Progress value={progressPercent} className="h-2 mb-3" />

      {/* Step dots / pills */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {stepNames.map((name, i) => {
          const Icon = stepIcons?.[i];
          return (
            <button
              key={i}
              onClick={() => onStepClick?.(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200",
                i === currentStep
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : i < currentStep
                  ? "bg-positive/10 text-positive hover:bg-positive/20"
                  : "bg-muted text-muted-foreground hover:bg-accent/10"
              )}
            >
              {Icon && <Icon size={14} />}
              {!compact && <span className="hidden sm:inline">{name}</span>}
              {compact && <span>{i + 1}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
