import { useState, useEffect } from 'react';
import { Heart, Trophy, AlertCircle } from 'lucide-react';

const CATEGORY_LABELS: Record<string, string> = {
  helped_understand: 'Помог разобраться',
  emotional_support: 'Поддержка',
  saved_deadline: 'Спас дедлайн',
  shared_expertise: 'Экспертиза',
  mentoring: 'Наставничество',
  team_support: 'Командная поддержка',
};

interface TopReceiver {
  name: string;
  count: number;
  topCategory: string;
}

export default function EmbedTopKudos() {
  const params = new URLSearchParams(window.location.search);
  const period = params.get('period') || '30d';
  const teamId = params.get('teamId') || '';
  const limit = params.get('limit') || '10';
  const theme = params.get('theme') || 'light';

  const [topReceivers, setTopReceivers] = useState<TopReceiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    loadData();
  }, []);

  async function loadData() {
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const baseUrl = projectId
        ? `https://${projectId}.supabase.co/functions/v1`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      const queryParams = new URLSearchParams({ period, limit });
      if (teamId) queryParams.set('teamId', teamId);

      const res = await fetch(`${baseUrl}/top-kudos?${queryParams}`, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTopReceivers(json.data || []);
    } catch (e) {
      console.error('Failed to load top kudos:', e);
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }

  const periodLabel = period === '7d' ? '7 дней' : period === '90d' ? '90 дней' : '30 дней';

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto font-sans flex items-center justify-center min-h-[200px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-lg mx-auto font-sans">
        <div className="flex items-center gap-2 text-destructive py-8 justify-center">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto font-sans">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={20} className="text-chart-4" />
        <h2 className="text-lg font-bold">Топ по благодарностям</h2>
        <span className="text-xs text-muted-foreground ml-auto">{periodLabel}</span>
      </div>
      <div className="space-y-2">
        {topReceivers.map((r, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{r.name}</p>
              {r.topCategory && (
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[r.topCategory] || r.topCategory}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Heart size={14} className="text-positive" />
              <span className="font-bold text-sm">{r.count}</span>
            </div>
          </div>
        ))}
        {topReceivers.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Пока нет благодарностей за выбранный период</p>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-4">Powered by МИРА</p>
    </div>
  );
}
