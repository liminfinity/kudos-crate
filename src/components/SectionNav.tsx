import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SectionTab {
  label: string;
  path: string;
  icon?: LucideIcon;
  /** Match path prefix instead of exact match */
  matchPrefix?: boolean;
}

interface SectionNavProps {
  tabs: SectionTab[];
}

export function SectionNav({ tabs }: SectionNavProps) {
  const location = useLocation();

  function isActive(tab: SectionTab) {
    if (tab.matchPrefix) return location.pathname.startsWith(tab.path);
    return location.pathname === tab.path;
  }

  return (
    <nav className="flex gap-1 p-1 bg-muted/50 rounded-xl w-fit mb-6 overflow-x-auto flex-shrink-0">
      {tabs.map(tab => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            {Icon && <Icon size={16} />}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
