import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WorkEpisode } from '@/lib/supabase-types';
import { format, parseISO } from 'date-fns';

export default function AdminEpisodes() {
  const [episodes, setEpisodes] = useState<WorkEpisode[]>([]);

  useEffect(() => {
    supabase.from('work_episodes').select('*').order('date', { ascending: false })
      .then(({ data }) => { if (data) setEpisodes(data as unknown as WorkEpisode[]); });
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold">Эпизоды</h1>
          <p className="text-muted-foreground">Рабочие эпизоды и задачи</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.map(ep => (
                  <TableRow key={ep.id}>
                    <TableCell className="font-medium">{ep.title}</TableCell>
                    <TableCell>{format(parseISO(ep.date), 'dd.MM.yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{ep.description || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{ep.external_ref || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
