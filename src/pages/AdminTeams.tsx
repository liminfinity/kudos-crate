import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Team, Profile } from '@/lib/supabase-types';

export default function AdminTeams() {
  const [teams, setTeams] = useState<(Team & { managerName?: string; memberCount?: number })[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('none');

  useEffect(() => { load(); }, []);

  async function load() {
    const [teamsRes, profRes] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, team_id, email, is_active, created_at, updated_at'),
    ]);

    const profs = (profRes.data || []) as unknown as Profile[];
    setProfiles(profs);
    const profMap: Record<string, string> = {};
    const teamCounts: Record<string, number> = {};
    profs.forEach(p => {
      profMap[p.id] = p.full_name;
      if (p.team_id) teamCounts[p.team_id] = (teamCounts[p.team_id] || 0) + 1;
    });

    setTeams(
      ((teamsRes.data || []) as unknown as Team[]).map(t => ({
        ...t,
        managerName: t.manager_user_id ? profMap[t.manager_user_id] : undefined,
        memberCount: teamCounts[t.id] || 0,
      }))
    );
  }

  function openCreate() {
    setEditing(null);
    setName('');
    setManagerId('none');
    setDialogOpen(true);
  }

  function openEdit(t: Team) {
    setEditing(t);
    setName(t.name);
    setManagerId(t.manager_user_id || 'none');
    setDialogOpen(true);
  }

  async function handleSave() {
    const mgrId = managerId === 'none' ? null : managerId;
    if (editing) {
      const { error } = await supabase.from('teams').update({ name, manager_user_id: mgrId }).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Команда обновлена');
    } else {
      const { error } = await supabase.from('teams').insert({ name, manager_user_id: mgrId });
      if (error) { toast.error(error.message); return; }
      toast.success('Команда создана');
    }
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить команду?')) return;
    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Команда удалена');
    load();
  }

  return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Команды</h1>
            <p className="text-muted-foreground">Управление командами</p>
          </div>
          <Button onClick={openCreate} className="gap-1"><Plus size={16} /> Создать</Button>
        </div>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Руководитель</TableHead>
                  <TableHead className="text-center">Участников</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.managerName || '—'}</TableCell>
                    <TableCell className="text-center">{t.memberCount}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil size={14} /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 size={14} /></Button>
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
              <DialogTitle>{editing ? 'Редактировать команду' : 'Новая команда'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Руководитель</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Не назначен —</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} disabled={!name.trim()}>{editing ? 'Сохранить' : 'Создать'}</Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
