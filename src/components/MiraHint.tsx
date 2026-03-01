import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import miraAvatar from '@/assets/mira-avatar.png';

interface MiraHintProps {
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
  variant?: 'inline' | 'tip' | 'intervention';
  action?: { label: string; onClick: () => void };
}

export function MiraHint({ children, className, dismissible = true, variant = 'inline', action }: MiraHintProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg p-3 text-sm animate-fade-in transition-all',
      variant === 'inline' && 'bg-accent/10 border border-accent/20',
      variant === 'tip' && 'bg-primary/5 border border-primary/15',
      variant === 'intervention' && 'bg-chart-4/10 border border-chart-4/20',
      className
    )}>
      <img src={miraAvatar} alt="МИРА" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Sparkles size={12} className="text-accent flex-shrink-0" />
          <span className="text-[11px] font-medium text-accent">МИРА</span>
        </div>
        <div className="text-foreground/80 leading-relaxed">{children}</div>
        {action && (
          <button onClick={action.onClick} className="mt-2 text-xs font-medium text-accent hover:text-accent/80 underline underline-offset-2 transition-colors">
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button onClick={() => setVisible(false)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
