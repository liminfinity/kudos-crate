import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Subcategory, SentimentType } from '@/lib/supabase-types';

export default function SubcategoriesPage() {
  const [subcats, setSubcats] = useState<Subcategory[]>([]);
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Subcategory | null>(null);
  const [name, setName] = useState('');
  const [sentiment, setSentiment] = useState<SentimentType>('positive');

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('subcategories').select('*').order('sort_order');
    if (data) setSubcats(data as unknown as Subcategory[]);
  }

  const filtered = filter === 'all' ? subcats : subcats.filter(s => s.sentiment === filter);

  async function handleAdd() {
    if (!name.trim()) return;
    await supabase.from('subcategories').insert({ name: name.trim(), sentiment });
    setName('');
    setAddOpen(false);
    load();
  }

  async function handleEdit() {
    if (!editItem || !name.trim()) return;
    await supabase.from('subcategories').update({ name: name.trim() }).eq('id', editItem.id);
    setEditItem(null);
    setName('');
    load();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from('subcategories').update({ is_active: !current }).eq('id', id);
    load();
  }

  return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Подкатегории</h1>
            <p className="text-muted-foreground">Управление справочником подкатегорий отзывов</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus size={16} /> Добавить</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Новая подкатегория</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Тональность</Label>
                  <Select value={sentiment} onValueChange={v => setSentiment(v as SentimentType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">Позитивная</SelectItem>
                      <SelectItem value="negative">Негативная</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAdd} disabled={!name.trim()}>Создать</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground">Фильтр:</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="positive">Позитивные</SelectItem>
                  <SelectItem value="negative">Негативные</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Тональность</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-xs", s.sentiment === 'positive' ? 'bg-positive/15 text-positive border border-positive/30' : 'bg-negative/15 text-negative border border-negative/30')}>
                        {s.sentiment === 'positive' ? 'Позитивная' : 'Негативная'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setEditItem(s); setName(s.name); }}>
                        <Pencil size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit dialog */}
        <Dialog open={!!editItem} onOpenChange={open => { if (!open) setEditItem(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Редактировать подкатегорию</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <Button onClick={handleEdit} disabled={!name.trim()}>Сохранить</Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
