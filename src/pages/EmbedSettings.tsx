import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Code2, ExternalLink, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Cycle {
  id: string;
  label: string;
  status: string;
  period_start: string;
  period_end: string;
  template: { name: string };
}

export default function EmbedSettings() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const baseUrl = window.location.origin;

  useEffect(() => {
    loadCycles();
  }, []);

  async function loadCycles() {
    const { data } = await supabase
      .from('survey_cycles')
      .select('id, label, status, period_start, period_end, template:survey_templates!inner(name)')
      .order('created_at', { ascending: false });
    if (data) {
      setCycles(data as any);
      if (data.length > 0) setSelectedCycleId(data[0].id);
    }
    setLoading(false);
  }

  const embedUrl = `${baseUrl}/embed/survey/${selectedCycleId}?theme=${theme}`;

  const iframeCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  style="border:none;border-radius:12px;max-width:720px;"
  loading="lazy"
  allow="clipboard-write"
></iframe>
<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'mira-resize') {
    var frames = document.querySelectorAll('iframe');
    frames.forEach(function(f) {
      if (f.src.includes('${selectedCycleId}')) {
        f.style.height = e.data.height + 'px';
      }
    });
  }
});
</script>`;

  const jsCode = `<div id="mira-survey"></div>
<script src="${baseUrl}/widget.js"></script>
<script>
  MiraWidget.init({
    surveyId: "${selectedCycleId}",
    theme: "${theme}",
    position: "inline",
    container: "#mira-survey"
  });
</script>`;

  const popupCode = `<script src="${baseUrl}/widget.js"></script>
<script>
  MiraWidget.init({
    surveyId: "${selectedCycleId}",
    theme: "${theme}",
    position: "floating"
  });
</script>`;

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Код скопирован');
    setTimeout(() => setCopied(false), 2000);
  }

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Встраивание опросов</h1>
        <p className="text-muted-foreground mb-6">Получите код для размещения опроса на внешнем сайте</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : cycles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Пока нет доступных опросов для встраивания
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Settings */}
            <Card>
              <CardHeader><CardTitle className="text-base">Настройки</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Опрос</Label>
                    <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cycles.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {(c as any).template?.name || c.label} — {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Тема</Label>
                    <Select value={theme} onValueChange={(v: 'light' | 'dark') => setTheme(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Светлая</SelectItem>
                        <SelectItem value="dark">Тёмная</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {selectedCycle && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant={selectedCycle.status === 'open' ? 'default' : 'secondary'}>
                      {selectedCycle.status === 'open' ? 'Открыт' : selectedCycle.status === 'draft' ? 'Черновик' : 'Закрыт'}
                    </Badge>
                    <span>Период: {selectedCycle.period_start} — {selectedCycle.period_end}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Предпросмотр</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => window.open(embedUrl, '_blank')}>
                    <ExternalLink size={14} className="mr-1" /> Открыть
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                  <iframe
                    src={embedUrl}
                    width="100%"
                    height="500"
                    style={{ border: 'none', borderRadius: '12px' }}
                    loading="lazy"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Code */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code2 size={18} /> Код для встраивания</CardTitle></CardHeader>
              <CardContent>
                <Tabs defaultValue="iframe">
                  <TabsList className="mb-4">
                    <TabsTrigger value="iframe">Iframe</TabsTrigger>
                    <TabsTrigger value="js-inline">JS (inline)</TabsTrigger>
                    <TabsTrigger value="js-popup">JS (popup)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="iframe">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{iframeCode}</pre>
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => copyToClipboard(iframeCode)}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Самый простой способ. Вставьте код на HTML-страницу. Высота подстроится автоматически.</p>
                  </TabsContent>

                  <TabsContent value="js-inline">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{jsCode}</pre>
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => copyToClipboard(jsCode)}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Встраивание через JavaScript SDK. Опрос появится в указанном контейнере.</p>
                  </TabsContent>

                  <TabsContent value="js-popup">
                    <div className="relative">
                      <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{popupCode}</pre>
                      <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => copyToClipboard(popupCode)}>
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Плавающая кнопка в правом нижнем углу. При клике открывает опрос в модальном окне.</p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
              <CardHeader><CardTitle className="text-base">Параметры</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Параметр</th>
                        <th className="text-left py-2 font-medium">Тип</th>
                        <th className="text-left py-2 font-medium">Описание</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr className="border-b border-border">
                        <td className="py-2 font-mono text-xs">surveyId</td>
                        <td className="py-2">string</td>
                        <td className="py-2">ID цикла опроса</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-mono text-xs">theme</td>
                        <td className="py-2">"light" | "dark"</td>
                        <td className="py-2">Цветовая тема виджета</td>
                      </tr>
                      <tr className="border-b border-border">
                        <td className="py-2 font-mono text-xs">position</td>
                        <td className="py-2">"inline" | "floating"</td>
                        <td className="py-2">Режим отображения (только JS)</td>
                      </tr>
                      <tr>
                        <td className="py-2 font-mono text-xs">container</td>
                        <td className="py-2">string (CSS-селектор)</td>
                        <td className="py-2">Контейнер для inline-режима</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
