import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Pencil, Plus, Trash2, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, Team, AppRole } from '@/lib/supabase-types';

export default function AdminUsers() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<(Profile & { role?: AppRole; teamName?: string })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editTeamId, setEditTeamId] = useState('none');
  const [editRole, setEditRole] = useState<string>('employee');
  const [editActive, setEditActive] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newTeamId, setNewTeamId] = useState('none');
  const [creating, setCreating] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editingProfile) return;
    const teamId = editTeamId === 'none' ? null : editTeamId;

    const { error: profErr } = await supabase.from('profiles')
      .update({ full_name: editName, team_id: teamId, is_active: editActive })
      .eq('id', editingProfile.id);
    if (profErr) { toast.error(profErr.message); return; }

    const { error: roleErr } = await supabase.from('user_roles')
      .update({ role: editRole as AppRole })
      .eq('user_id', editingProfile.id);
    if (roleErr) { toast.error(roleErr.message); return; }

    toast.success('Пользователь обновлён');
    setEditOpen(false);
    load();
  }

  async function handleCreate() {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create',
          email: newEmail,
          full_name: newName,
          role: newRole,
          team_id: newTeamId === 'none' ? null : newTeamId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка создания');

      setTempPassword(result.temp_password);
      toast.success('Пользователь создан');
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  function closeCreateDialog() {
    setCreateOpen(false);
    setNewName('');
    setNewEmail('');
    setNewRole('employee');
    setNewTeamId('none');
    setTempPassword(null);
  }

  function openDelete(p: Profile) {
    setDeletingUser(p);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete', user_id: deletingUser.id }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ошибка удаления');

      toast.success('Пользователь деактивирован');
      setDeleteOpen(false);
      setDeletingUser(null);
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  const roleLabels: Record<string, string> = {
    employee: 'Сотрудник', manager: 'Руководитель', hr: 'HR', admin: 'Администратор',
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Пользователи</h1>
            <p className="text-muted-foreground">Управление пользователями системы</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-1">
            <Plus size={16} /> Создать пользователя
          </Button>
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
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map(p => (
                  <TableRow key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
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
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil size={14} />
                        </Button>
                        {p.is_active && p.id !== user?.id && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(p)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
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

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={v => { if (!v) closeCreateDialog(); else setCreateOpen(true); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tempPassword ? 'Пользователь создан' : 'Создать пользователя'}</DialogTitle>
            </DialogHeader>
            {tempPassword ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-positive/10 text-positive">
                  <CheckCircle2 size={18} />
                  <span className="font-medium">Пользователь успешно создан!</span>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Временный пароль (покажите пользователю)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={tempPassword} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success('Скопировано'); }}
                    >
                      <Copy size={14} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Пользователь должен сменить пароль после первого входа.</p>
                </div>
                <Button onClick={closeCreateDialog} className="w-full">Закрыть</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label>Имя *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Иван Иванов" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="ivan@company.com" />
                </div>
                <div>
                  <Label>Роль</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Команда</Label>
                  <Select value={newTeamId} onValueChange={setNewTeamId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Без команды —</SelectItem>
                      {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">Пароль будет сгенерирован автоматически.</p>
                <Button onClick={handleCreate} disabled={creating || !newName.trim() || !newEmail.trim()} className="w-full">
                  {creating ? 'Создание...' : 'Создать'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Деактивировать пользователя?</AlertDialogTitle>
              <AlertDialogDescription>
                Пользователь <strong>{deletingUser?.full_name}</strong> будет деактивирован и не сможет входить в систему. 
                Все существующие отзывы и аналитика сохранятся.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? 'Деактивация...' : 'Деактивировать'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
