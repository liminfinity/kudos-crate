import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, Team, AppRole } from '@/lib/supabase-types';

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<(Profile & { role?: AppRole; teamName?: string })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editTeamId, setEditTeamId] = useState('none');
  const [editRole, setEditRole] = useState<string>('employee');
  const [editActive, setEditActive] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    const [profRes, rolesRes, teamsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('teams').select('*'),
    ]);

    const roles: Record<string, string> = {};
    (rolesRes.data as any[] || []).forEach(r => { roles[r.user_id] = r.role; });

    const tms = (teamsRes.data as unknown as Team[]) || [];
    setTeams(tms);
    const teamMap: Record<string, string> = {};
    tms.forEach(t => { teamMap[t.id] = t.name; });

    const data = (profRes.data as unknown as Profile[] || []).map(p => ({
      ...p,
      role: roles[p.id] as AppRole,
      teamName: p.team_id ? teamMap[p.team_id] : undefined,
    }));
    setProfiles(data);
  }

  function openEdit(p: Profile & { role?: AppRole }) {
    setEditingProfile(p);
    setEditName(p.full_name);
    setEditTeamId(p.team_id || 'none');
    setEditRole(p.role || 'employee');
    setEditActive(p.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingProfile) return;
    const teamId = editTeamId === 'none' ? null : editTeamId;

    const { error: profErr } = await supabase.from('profiles')
      .update({ full_name: editName, team_id: teamId, is_active: editActive })
      .eq('id', editingProfile.id);
    if (profErr) { toast.error(profErr.message); return; }

    // Update role
    const { error: roleErr } = await supabase.from('user_roles')
      .update({ role: editRole as AppRole })
      .eq('user_id', editingProfile.id);
    if (roleErr) { toast.error(roleErr.message); return; }

    toast.success('Пользователь обновлён');
    setDialogOpen(false);
    load();
  }

  const roleLabels: Record<string, string> = {
    employee: 'Сотрудник', manager: 'Руководитель', hr: 'HR', admin: 'Администратор',
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-muted-foreground">Управление пользователями системы</p>
        </div>

        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{p.role ? roleLabels[p.role] : '—'}</Badge>
                    </TableCell>
                    <TableCell>{p.teamName || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? 'default' : 'secondary'}>
                        {p.is_active ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil size={14} /></Button>
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
              <DialogTitle>Редактировать пользователя</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Имя</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <Label>Команда</Label>
                <Select value={editTeamId} onValueChange={setEditTeamId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Без команды —</SelectItem>
                    {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Роль</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} id="activeCheck" />
                <Label htmlFor="activeCheck">Активен</Label>
              </div>
              <Button onClick={handleSave} disabled={!editName.trim()}>Сохранить</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
