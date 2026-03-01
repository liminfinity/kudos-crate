import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Play, Square, Loader2, Users, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Review360Cycles() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [openFrom, setOpenFrom] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [requiredReviews, setRequiredReviews] = useState(3);
  const [maxAssignments, setMaxAssignments] = useState(4);

  useEffect(() => { loadCycles(); }, []);

  async function loadCycles() {
    const { data } = await supabase.from('review_360_cycles' as any).select('*').order('created_at', { ascending: false });
    if (data) setCycles(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!title || !openFrom || !dueDate || !user) return;
    const { error } = await supabase.from('review_360_cycles' as any).insert({
      title,
      year,
      open_from: openFrom,
      due_date: dueDate,
      created_by: user.id,
      required_reviews_per_user: requiredReviews,
      max_assignments_per_reviewer: maxAssignments,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Цикл 360 создан');
    setCreateOpen(false);
    setTitle('');
    loadCycles();
  }

  async function publishCycle(cycleId: string) {
    setPublishing(cycleId);
    try {
      // Update status
      const { error: statusErr } = await supabase.from('review_360_cycles' as any)
        .update({ status: 'published' }).eq('id', cycleId);
      if (statusErr) throw statusErr;

      // Generate assignments via edge function
      const { error: genErr } = await supabase.functions.invoke('generate-360-assignments', {
        body: { cycleId },
      });
      if (genErr) throw genErr;

      toast.success('Цикл опубликован, назначения сгенерированы');
      loadCycles();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка при публикации');
    }
    setPublishing(null);
  }

  async function closeCycle(cycleId: string) {
    const { error } = await supabase.from('review_360_cycles' as any)
      .update({ status: 'closed' }).eq('id', cycleId);
    if (error) toast.error(error.message);
    else { toast.success('Цикл закрыт'); loadCycles(); }
  }

  const statusBadge = (s: string) => {
    if (s === 'draft') return <Badge variant="secondary">Черновик</Badge>;
    if (s === 'published') return <Badge>Опубликован</Badge>;
    return <Badge variant="outline">Закрыт</Badge>;
  };

  return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Отзывы 360</h1>
            <p className="text-muted-foreground">Годовые циклы ревью с рандомным назначением коллег</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus size={16} /> Новый цикл</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Новый цикл 360</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Название</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ревью 360 — 2026" /></div>
                <div><Label>Год</Label><Input type="number" value={year} onChange={e => setYear(Number(e.target.value))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Открыть с</Label><Input type="date" value={openFrom} onChange={e => setOpenFrom(e.target.value)} /></div>
                  <div><Label>Дедлайн</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Мин. отзывов на сотрудника</Label><Input type="number" value={requiredReviews} onChange={e => setRequiredReviews(Number(e.target.value))} min={1} max={10} /></div>
                  <div><Label>Макс. назначений на автора</Label><Input type="number" value={maxAssignments} onChange={e => setMaxAssignments(Number(e.target.value))} min={1} max={10} /></div>
                </div>
                <Button onClick={handleCreate} disabled={!title || !openFrom || !dueDate} className="w-full">Создать</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : cycles.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет циклов 360. Создайте первый.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {cycles.map(c => (
              <Card key={c.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{c.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Год: {c.year} • Период: {new Date(c.open_from).toLocaleDateString()} — {new Date(c.due_date).toLocaleDateString()}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {statusBadge(c.status)}
                        <span className="text-xs text-muted-foreground">Мин. {c.required_reviews_per_user} отзывов • Макс. {c.max_assignments_per_reviewer} назначений</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {c.status === 'draft' && (
                        <Button size="sm" onClick={() => publishCycle(c.id)} disabled={publishing === c.id}>
                          {publishing === c.id ? <Loader2 size={14} className="animate-spin mr-1" /> : <Play size={14} className="mr-1" />}
                          Опубликовать
                        </Button>
                      )}
                      {c.status === 'published' && (
                        <Button size="sm" variant="outline" onClick={() => closeCycle(c.id)}>
                          <Square size={14} className="mr-1" /> Закрыть
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/review-360/${c.id}/analytics`}><BarChart3 size={14} className="mr-1" /> Аналитика</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
