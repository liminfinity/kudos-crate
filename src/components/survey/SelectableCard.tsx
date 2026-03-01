import { cn } from '@/lib/utils';

interface SelectableCardProps {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  emoji?: string;
  icon?: React.ReactNode;
  label: string;
  description?: string;
  colorClass?: string;
  className?: string;
}

export function SelectableCard({
  selected, onClick, disabled, emoji, icon, label, description, colorClass, className,
}: SelectableCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200",
        "hover:shadow-md active:scale-[0.98]",
        selected
          ? cn(
              colorClass || "bg-primary/10 border-primary/30",
              "ring-2 ring-primary/20 shadow-sm"
            )
          : "bg-card border-border hover:bg-muted/50",
        disabled && "opacity-40 cursor-not-allowed hover:shadow-none active:scale-100",
        className,
      )}
    >
      {emoji && <span className="text-2xl flex-shrink-0">{emoji}</span>}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </button>
  );
}
