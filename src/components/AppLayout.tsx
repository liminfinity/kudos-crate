import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquarePlus, BarChart3, Tags, Users, Building2, CalendarDays,
  LogOut, ClipboardList, BookOpen, PieChart, Activity, AlertTriangle,
  Heart, Award, Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: string[];
  section?: string;
}

const navItems: NavItem[] = [
  { label: 'Оставить отзыв', path: '/feedback/new', icon: <MessageSquarePlus size={16} />, roles: ['employee', 'manager', 'hr', 'admin'], section: 'main' },
  { label: 'Благодарности', path: '/kudos/new', icon: <Heart size={16} />, roles: ['employee', 'manager', 'hr', 'admin'], section: 'main' },
  { label: 'Мои опросы', path: '/surveys', icon: <ClipboardList size={16} />, roles: ['employee', 'manager', 'hr', 'admin'], section: 'main' },
  { label: 'Атмосфера', path: '/mood', icon: <Activity size={16} />, roles: ['employee', 'manager', 'hr', 'admin'], section: 'main' },
  { label: 'Аналитика', path: '/dashboard', icon: <BarChart3 size={16} />, roles: ['manager', 'hr', 'admin'], section: 'analytics' },
  { label: 'Благодарности', path: '/kudos/dashboard', icon: <Award size={16} />, roles: ['manager', 'hr', 'admin'], section: 'analytics' },
  { label: 'Полугодовой срез', path: '/analytics/half-year', icon: <PieChart size={16} />, roles: ['manager', 'hr', 'admin'], section: 'analytics' },
  { label: 'Дневник руководителя', path: '/leader-diary', icon: <BookOpen size={16} />, roles: ['manager', 'hr', 'admin'], section: 'analytics' },
  { label: 'Серьёзные сигналы', path: '/incidents', icon: <AlertTriangle size={16} />, roles: ['hr', 'admin'], section: 'analytics' },
  { label: 'Подкатегории', path: '/subcategories', icon: <Tags size={16} />, roles: ['manager', 'hr', 'admin'], section: 'settings' },
  { label: 'Пользователи', path: '/admin/users', icon: <Users size={16} />, roles: ['admin'], section: 'settings' },
  { label: 'Команды', path: '/admin/teams', icon: <Building2 size={16} />, roles: ['admin'], section: 'settings' },
  { label: 'Эпизоды', path: '/admin/episodes', icon: <CalendarDays size={16} />, roles: ['admin'], section: 'settings' },
];

const sectionLabels: Record<string, string> = {
  main: 'Основное',
  analytics: 'Аналитика',
  settings: 'Настройки',
};

function NavLinks({ items, location, onNavigate }: { items: NavItem[]; location: ReturnType<typeof useLocation>; onNavigate?: () => void }) {
  const sections = ['main', 'analytics', 'settings'];
  const grouped = sections.map(s => ({ section: s, items: items.filter(i => i.section === s) })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map(g => (
        <div key={g.section}>
          <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/40 px-3 mb-1.5">
            {sectionLabels[g.section]}
          </p>
          <div className="space-y-0.5">
            {g.items.map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors duration-150",
                  location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MiraLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const textSize = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-bold tracking-widest", textSize)}>
        М<span className="relative">И<span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-sidebar-primary" /></span>РА
      </span>
    </div>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleItems = navItems.filter(item => role && item.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabels: Record<string, string> = {
    employee: 'Сотрудник',
    manager: 'Руководитель',
    hr: 'HR',
    admin: 'Администратор',
  };

  const userInfo = (
    <div className="p-4 border-t border-sidebar-border">
      <div className="mb-2">
        <p className="text-[13px] font-medium truncate">{profile?.full_name}</p>
        <p className="text-[11px] text-sidebar-foreground/40">{role ? roleLabels[role] : ''}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { handleSignOut(); setSheetOpen(false); }}
        className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs h-8"
      >
        <LogOut size={14} className="mr-2" />
        Выйти
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between px-4 h-12 border-b border-border bg-card flex-shrink-0">
          <MiraLogo size="sm" />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu size={18} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <SheetTitle className="sr-only">Навигация</SheetTitle>
              <div className="p-4 border-b border-sidebar-border">
                <MiraLogo />
              </div>
              <nav className="flex-1 p-3 overflow-y-auto max-h-[calc(100vh-160px)]">
                <NavLinks items={visibleItems} location={location} onNavigate={() => setSheetOpen(false)} />
              </nav>
              {userInfo}
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 max-w-[1200px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-4 pb-3 border-b border-sidebar-border">
          <MiraLogo />
          <p className="text-[10px] text-sidebar-foreground/30 mt-0.5 tracking-wide">обратная связь и развитие</p>
        </div>
        
        <nav className="flex-1 p-3 overflow-y-auto">
          <NavLinks items={visibleItems} location={location} />
        </nav>

        {userInfo}
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-6 lg:p-8 max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
