import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquarePlus,
  BarChart3,
  Tags,
  Users,
  Building2,
  CalendarDays,
  LogOut,
  ClipboardList,
  BookOpen,
  PieChart,
  Activity,
  AlertTriangle,
  Heart,
  Award,
  Menu,
  ThumbsUp,
  Zap,
  Lightbulb,
  Code2,
  Settings,
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
}

const navItems: NavItem[] = [
  { label: 'Оставить отзыв', path: '/feedback/new', icon: <MessageSquarePlus size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Благодарности', path: '/kudos/new', icon: <Heart size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Мои опросы', path: '/surveys', icon: <ClipboardList size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Атмосфера', path: '/mood', icon: <Activity size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Аналитика', path: '/dashboard', icon: <BarChart3 size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Благодарности (обзор)', path: '/kudos/dashboard', icon: <Award size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Удовлетворённость', path: '/satisfaction', icon: <ThumbsUp size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Вовлечённость', path: '/engagement', icon: <Zap size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Рекомендации', path: '/recommendations', icon: <Lightbulb size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Полугодовой срез', path: '/analytics/half-year', icon: <PieChart size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Дневник руководителя', path: '/leader-diary', icon: <BookOpen size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Серьёзные сигналы', path: '/incidents', icon: <AlertTriangle size={18} />, roles: ['hr', 'admin'] },
  { label: 'Подкатегории', path: '/subcategories', icon: <Tags size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Пользователи', path: '/admin/users', icon: <Users size={18} />, roles: ['admin'] },
  { label: 'Команды', path: '/admin/teams', icon: <Building2 size={18} />, roles: ['admin'] },
  { label: 'Эпизоды', path: '/admin/episodes', icon: <CalendarDays size={18} />, roles: ['admin'] },
  { label: 'Встраивание', path: '/admin/embed', icon: <Code2 size={18} />, roles: ['admin'] },
  { label: 'Настройки', path: '/settings', icon: <Settings size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
];

function NavLinks({ items, location, onNavigate }: { items: NavItem[]; location: ReturnType<typeof useLocation>; onNavigate?: () => void }) {
  return (
    <>
      {items.map(item => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              ? "bg-sidebar-accent text-sidebar-primary font-semibold"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
          )}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </>
  );
}

function MiraLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const textSize = size === 'sm' ? 'text-base' : 'text-lg';
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-bold tracking-wide", textSize)}>
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
      <div className="mb-3">
        <p className="text-sm font-medium truncate">{profile?.full_name}</p>
        <p className="text-xs text-sidebar-foreground/50">{role ? roleLabels[role] : ''}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => { handleSignOut(); setSheetOpen(false); }}
        className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <LogOut size={16} className="mr-2" />
        Выйти
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar text-sidebar-foreground flex-shrink-0">
          <MiraLogo size="sm" />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu size={22} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
              <SheetTitle className="sr-only">Навигация</SheetTitle>
              <div className="p-5 border-b border-sidebar-border">
                <MiraLogo />
              </div>
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-180px)]">
                <NavLinks items={visibleItems} location={location} onNavigate={() => setSheetOpen(false)} />
              </nav>
              {userInfo}
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <MiraLogo />
          <p className="text-[10px] text-sidebar-foreground/40 mt-1 tracking-wide">обратная связь и развитие</p>
        </div>
        
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLinks items={visibleItems} location={location} />
        </nav>

        {userInfo}
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
