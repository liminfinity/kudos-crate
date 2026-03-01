import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Team, Profile } from '@/lib/supabase-types';

export default function AdminTeams() {
  const [teams, setTeams] = useState<(Team & { managerName?: string; memberCount?: number })[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const [teamsRes, profRes] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, team_id'),
    ]);

    const profs = (profRes.data || []) as unknown as Profile[];
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

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Команды</h1>
          <p className="text-muted-foreground">Управление командами</p>
        </div>
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Руководитель</TableHead>
                  <TableHead className="text-center">Участников</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.managerName || '—'}</TableCell>
                    <TableCell className="text-center">{t.memberCount}</TableCell>
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
