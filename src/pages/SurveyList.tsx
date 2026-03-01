import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

interface Assignment {
  id: string;
  cycle_id: string;
  status: string;
  submitted_at: string | null;
  created_at: string;
  cycle: {
    id: string;
    label: string;
    due_date: string;
    open_from: string;
    period_start: string;
    period_end: string;
    template: {
      name: string;
      type: string;
    };
  };
}

const statusLabels: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  submitted: 'Отправлен',
  overdue: 'Просрочен',
};

const statusIcons: Record<string, React.ReactNode> = {
  not_started: <Clock size={16} className="text-muted-foreground" />,
  in_progress: <ClipboardList size={16} className="text-primary" />,
  submitted: <CheckCircle2 size={16} className="text-positive" />,
  overdue: <AlertTriangle size={16} className="text-destructive" />,
};

export default function SurveyList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAssignments();
  }, [user]);

  async function loadAssignments() {
    const { data } = await supabase
      .from('survey_assignments')
      .select(`
        id, cycle_id, status, submitted_at, created_at,
        cycle:survey_cycles!inner(
          id, label, due_date, open_from, period_start, period_end,
          template:survey_templates!inner(name, type)
        )
      `)
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (data) {
      const mapped = (data as any[]).map(d => ({
        ...d,
        cycle: {
          ...d.cycle,
          template: d.cycle.template,
        }
      }));
      setAssignments(mapped);
    }
    setLoading(false);
  }

  function handleOpen(a: Assignment) {
    if (a.cycle.template.type === 'half_year_employee') {
      navigate(`/surveys/${a.id}`);
    } else {
      navigate(`/leader-diary/${a.id}`);
    }
  }

  return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Опросы</h1>
        <p className="text-muted-foreground mb-6">Назначенные опросы и анкеты</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              У вас пока нет назначенных опросов
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {statusIcons[a.status]}
                        <h3 className="font-semibold">{a.cycle.template.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {a.cycle.label} • Период: {a.cycle.period_start} — {a.cycle.period_end}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Дедлайн: {format(parseISO(a.cycle.due_date), 'd MMM yyyy', { locale: ru })}</span>
                        <Badge variant={a.status === 'submitted' ? 'default' : a.status === 'overdue' ? 'destructive' : 'secondary'} className="text-xs">
                          {statusLabels[a.status]}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={a.status === 'submitted' ? 'outline' : 'default'}
                      onClick={() => handleOpen(a)}
                    >
                      {a.status === 'submitted' ? 'Просмотр' : 'Заполнить'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}