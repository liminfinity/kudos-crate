import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState, useEffect, useCallback } from 'react';

export interface SectionTab {
  label: string;
  path: string;
  icon?: LucideIcon;
  matchPrefix?: boolean;
}

interface SectionNavProps {
  tabs: SectionTab[];
}

export function SectionNav({ tabs }: SectionNavProps) {
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function isActive(tab: SectionTab) {
    if (tab.matchPrefix) return location.pathname.startsWith(tab.path);
    return location.pathname === tab.path;
  }

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, tabs]);

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="true"]') as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [location.pathname]);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <nav className="relative flex items-center gap-0 mb-6 flex-shrink-0" role="tablist">
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scroll(-1)}
        className={cn(
          "flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
          !canScrollLeft && "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll left"
        tabIndex={-1}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scrollable tabs */}
      <div className="relative overflow-hidden flex-1 min-w-0">
        {/* Left fade */}
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-background to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          ref={scrollRef}
          className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {tabs.map(tab => {
            const active = isActive(tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                role="tab"
                aria-selected={active}
                data-active={active}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0",
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
        </div>

        {/* Right fade */}
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-background to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scroll(1)}
        className={cn(
          "flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all",
          !canScrollRight && "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll right"
        tabIndex={-1}
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}
