import { cn } from '@/lib/utils';

interface LikertOption {
  label: string;
  emoji: string;
}

interface LikertCardsProps {
  question: string;
  options: LikertOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function LikertCards({ question, options, value, onChange, disabled }: LikertCardsProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-all">
      <p className="text-sm font-medium mb-3">{question}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map(opt => (
          <button
            key={opt.label}
            type="button"
            onClick={() => !disabled && onChange(opt.label)}
            disabled={disabled}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-all duration-200",
              "hover:shadow-sm active:scale-[0.97]",
              value === opt.label
                ? "bg-primary/10 border-primary/30 text-foreground font-medium ring-1 ring-primary/20"
                : "bg-card border-border hover:bg-muted/50 text-muted-foreground"
            )}
          >
            <span className="text-xl">{opt.emoji}</span>
            <span className="text-center leading-tight">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
