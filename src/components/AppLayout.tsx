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
  Shield,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: 'Новый отзыв', path: '/feedback/new', icon: <MessageSquarePlus size={18} />, roles: ['employee', 'manager', 'hr', 'admin'] },
  { label: 'Дашборд', path: '/dashboard', icon: <BarChart3 size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Подкатегории', path: '/subcategories', icon: <Tags size={18} />, roles: ['manager', 'hr', 'admin'] },
  { label: 'Пользователи', path: '/admin/users', icon: <Users size={18} />, roles: ['admin'] },
  { label: 'Команды', path: '/admin/teams', icon: <Building2 size={18} />, roles: ['admin'] },
  { label: 'Эпизоды', path: '/admin/episodes', icon: <CalendarDays size={18} />, roles: ['admin'] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navLinks = (onNavigate?: () => void) =>
    visibleItems.map(item => (
      <Link
        key={item.path}
        to={item.path}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          location.pathname === item.path
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        {item.icon}
        {item.label}
      </Link>
    ));

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-sidebar-primary" />
            <h1 className="text-lg font-bold">Peer Feedback</h1>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navLinks()}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3">
            <p className="text-sm font-medium truncate">{profile?.full_name}</p>
            <p className="text-xs text-sidebar-foreground/50">{role ? roleLabels[role] : ''}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut size={16} className="mr-2" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Mobile sheet nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <SheetHeader className="p-5 border-b border-sidebar-border">
            <SheetTitle className="flex items-center gap-2 text-sidebar-foreground">
              <Shield size={22} className="text-sidebar-primary" />
              Peer Feedback
            </SheetTitle>
          </SheetHeader>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navLinks(() => setMobileOpen(false))}
          </nav>

          <div className="p-4 border-t border-sidebar-border mt-auto">
            <div className="mb-3">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-sidebar-foreground/50">{role ? roleLabels[role] : ''}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMobileOpen(false); handleSignOut(); }}
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut size={16} className="mr-2" />
              Выйти
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page wrapper: mobile top bar + scrollable content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-sidebar-primary" />
            <span className="font-bold text-base">Peer Feedback</span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
