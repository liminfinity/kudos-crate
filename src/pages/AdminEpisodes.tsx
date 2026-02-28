import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import type { WorkEpisode } from '@/lib/supabase-types';

export default function AdminEpisodes() {
  const { user } = useAuth();
  const [episodes, setEpisodes] = useState<WorkEpisode[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WorkEpisode | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [externalRef, setExternalRef] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('work_episodes').select('*').order('date', { ascending: false });
    if (data) setEpisodes(data as unknown as WorkEpisode[]);
  }

  function openCreate() {
    setEditing(null);
    setTitle('');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setExternalRef('');
    setDialogOpen(true);
  }

  function openEdit(ep: WorkEpisode) {
    setEditing(ep);
    setTitle(ep.title);
    setDate(ep.date);
    setDescription(ep.description || '');
    setExternalRef(ep.external_ref || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (editing) {
      const { error } = await supabase.from('work_episodes').update({
        title, date, description: description || null, external_ref: externalRef || null,
      }).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Эпизод обновлён');
    } else {
      const { error } = await supabase.from('work_episodes').insert({
        title, date, description: description || null, external_ref: externalRef || null,
        created_by: user?.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success('Эпизод создан');
    }
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эпизод?')) return;
    const { error } = await supabase.from('work_episodes').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Эпизод удалён');
    load();
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Эпизоды</h1>
            <p className="text-muted-foreground">Рабочие эпизоды и задачи</p>
          </div>
          <Button onClick={openCreate} className="gap-1"><Plus size={16} /> Создать</Button>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Внешняя ссылка</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.map(ep => (
                  <TableRow key={ep.id}>
                    <TableCell className="font-medium">{ep.title}</TableCell>
                    <TableCell>{format(parseISO(ep.date), 'dd.MM.yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{ep.description || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{ep.external_ref || '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ep)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(ep.id)}><Trash2 size={14} /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Редактировать эпизод' : 'Новый эпизод'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Название</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>Дата</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div><Label>Описание</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><Label>Внешняя ссылка</Label><Input value={externalRef} onChange={e => setExternalRef(e.target.value)} /></div>
              <Button onClick={handleSave} disabled={!title.trim()}>{editing ? 'Сохранить' : 'Создать'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
