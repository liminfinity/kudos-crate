import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageSquarePlus, UserCheck, Heart } from 'lucide-react';

const FEEDBACK_TABS = [
  { label: 'Отзыв', path: '/feedback/new', icon: MessageSquarePlus },
  { label: 'Отзыв 180', path: '/feedback-180', icon: UserCheck },
  { label: 'Благодарность', path: '/kudos/new', icon: Heart },
];

export function FeedbackLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div>
      <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-xl w-fit">
        {FEEDBACK_TABS.map(tab => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
