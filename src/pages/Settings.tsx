import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/contexts/SettingsContext';
import { Sparkles, Sun, Moon, Monitor, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { showMiraHints, setShowMiraHints, theme, setTheme, compactMode, setCompactMode } = useSettings();

  const themeOptions = [
    { value: 'light', label: 'Светлая', icon: Sun },
    { value: 'dark', label: 'Тёмная', icon: Moon },
    { value: 'system', label: 'Системная', icon: Monitor },
  ] as const;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Настройки</h1>
        <p className="text-muted-foreground mb-6">Управление интерфейсом и персонализация</p>

        <div className="space-y-4">
          {/* Mira Hints */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles size={16} className="text-accent" />
                Подсказки Миры
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Показывать подсказки Миры</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Контекстные подсказки в формах и аналитике</p>
                </div>
                <Switch checked={showMiraHints} onCheckedChange={setShowMiraHints} />
              </div>
            </CardContent>
          </Card>

          {/* Theme */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Тема оформления</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map(opt => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border text-sm transition-all",
                        theme === opt.value
                          ? "bg-primary/10 border-primary/30 text-foreground font-medium ring-2 ring-primary/20"
                          : "bg-card border-border hover:bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <Icon size={20} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Compact Mode */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Minimize2 size={16} />
                Компактный режим
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Уменьшенные отступы</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Более плотное расположение элементов</p>
                </div>
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
