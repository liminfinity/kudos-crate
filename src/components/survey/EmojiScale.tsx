import { cn } from '@/lib/utils';

interface EmojiScaleOption {
  emoji: string;
  label: string;
  value: string;
}

interface EmojiScaleProps {
  options: EmojiScaleOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function EmojiScale({ options, value, onChange, disabled }: EmojiScaleProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => !disabled && onChange(opt.value)}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200",
            "hover:scale-110 active:scale-95",
            value === opt.value
              ? "bg-primary/10 ring-2 ring-primary/30 shadow-sm scale-110"
              : "hover:bg-muted/50",
            disabled && "opacity-40 cursor-not-allowed hover:scale-100",
          )}
          title={opt.label}
        >
          <span className="text-3xl sm:text-4xl">{opt.emoji}</span>
          <span className="text-[10px] sm:text-xs text-muted-foreground font-medium leading-tight text-center max-w-[60px]">
            {opt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
