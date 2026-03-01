import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Profile, Team, AppRole } from '@/lib/supabase-types';

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<(Profile & { role?: AppRole; teamName?: string })[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [profRes, rolesRes, teamsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('teams').select('*'),
    ]);
    
    const roles: Record<string, string> = {};
    (rolesRes.data as any[] || []).forEach(r => { roles[r.user_id] = r.role; });
    
    const teams: Record<string, string> = {};
    (teamsRes.data as any[] || []).forEach(t => { teams[t.id] = t.name; });

    const data = (profRes.data as unknown as Profile[] || []).map(p => ({
      ...p,
      role: roles[p.id] as AppRole,
      teamName: p.team_id ? teams[p.team_id] : undefined,
    }));
    setProfiles(data);
  }

  const roleLabels: Record<string, string> = {
    employee: 'Сотрудник',
    manager: 'Руководитель',
    hr: 'HR',
    admin: 'Администратор',
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
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Имя</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Статус</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
