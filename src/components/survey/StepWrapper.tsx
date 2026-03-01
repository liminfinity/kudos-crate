import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StepWrapperProps {
  icon?: LucideIcon;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function StepWrapper({ icon: Icon, title, children, className }: StepWrapperProps) {
  return (
    <div className={cn("animate-fade-in", className)}>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5 mb-5">
            {Icon && (
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
                <Icon size={18} className="text-primary" />
              </div>
            )}
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
