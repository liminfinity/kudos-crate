import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Copy, Code2, ExternalLink, Check, MessageSquarePlus, Heart, ClipboardList, Trophy, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import type { Team } from '@/lib/supabase-types';

interface Cycle {
  id: string;
  label: string;
  status: string;
  period_start: string;
  period_end: string;
  template: { name: string };
}

interface Episode {
  id: string;
  title: string;
  date: string;
}

type EmbedType = 'survey' | 'feedback' | 'kudos' | 'top-kudos' | 'cta';

export default function EmbedSettings() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [embedType, setEmbedType] = useState<EmbedType>('survey');
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  // Top Kudos settings
  const [kudosPeriod, setKudosPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [kudosTeam, setKudosTeam] = useState('');
  const [kudosLimit, setKudosLimit] = useState<'5' | '10'>('10');
  // CTA settings
  const [ctaLabel, setCtaLabel] = useState('Перейти в МИРУ');
  const [ctaSubtitle, setCtaSubtitle] = useState('');
  const [ctaTarget, setCtaTarget] = useState('/');
  const [ctaCustomPath, setCtaCustomPath] = useState('');
  const [ctaNewTab, setCtaNewTab] = useState(true);
  const [ctaSize, setCtaSize] = useState<'s' | 'm' | 'l'>('m');
  const [ctaStyle, setCtaStyle] = useState<'primary' | 'secondary' | 'outline'>('primary');

  const baseUrl = window.location.origin;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [cycRes, epRes, teamRes] = await Promise.all([
      supabase.from('survey_cycles').select('id, label, status, period_start, period_end, template:survey_templates!inner(name)').order('created_at', { ascending: false }),
      supabase.from('work_episodes').select('id, title, date').order('date', { ascending: false }).limit(50),
      supabase.from('teams').select('*'),
    ]);
    if (cycRes.data) { setCycles(cycRes.data as any); if (cycRes.data.length > 0) setSelectedCycleId(cycRes.data[0].id); }
    if (epRes.data) { setEpisodes(epRes.data as unknown as Episode[]); if (epRes.data.length > 0) setSelectedEpisodeId(epRes.data[0].id); }
    if (teamRes.data) setTeams(teamRes.data as unknown as Team[]);
    setLoading(false);
  }

  const ctaTargetPath = ctaTarget === 'custom' ? ctaCustomPath : ctaTarget;

  const embedUrl = embedType === 'survey'
    ? `${baseUrl}/embed/survey/${selectedCycleId}?theme=${theme}`
    : embedType === 'feedback'
    ? `${baseUrl}/embed/feedback?episodeId=${selectedEpisodeId}&theme=${theme}`
    : embedType === 'top-kudos'
    ? `${baseUrl}/embed/top-kudos?period=${kudosPeriod}&limit=${kudosLimit}${kudosTeam ? `&teamId=${kudosTeam}` : ''}&theme=${theme}`
    : embedType === 'cta'
    ? `${baseUrl}/embed/cta-button?label=${encodeURIComponent(ctaLabel)}&target=${encodeURIComponent(ctaTargetPath)}${ctaSubtitle ? `&subtitle=${encodeURIComponent(ctaSubtitle)}` : ''}&theme=${theme}&size=${ctaSize}&style=${ctaStyle}&newTab=${ctaNewTab}`
    : `${baseUrl}/embed/kudos?theme=${theme}`;

  function generateIframeCode() {
    const height = embedType === 'cta' ? 120 : embedType === 'top-kudos' ? 520 : embedType === 'kudos' ? 520 : embedType === 'feedback' ? 720 : 600;
    const maxWidth = embedType === 'cta' ? 'max-width:400px;' : 'max-width:720px;';
    return `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  style="border:none;border-radius:12px;${maxWidth}"
  loading="lazy"
  allow="clipboard-write"
></iframe>`;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Код скопирован');
    setTimeout(() => setCopied(false), 2000);
  }

  const embedTypeLabels: Record<EmbedType, { label: string; icon: any; desc: string }> = {
    survey: { label: 'Опрос', icon: ClipboardList, desc: 'Встроить полугодовой опрос' },
    feedback: { label: 'Отзыв по эпизоду', icon: MessageSquarePlus, desc: 'Отзыв на конкретный рабочий эпизод' },
    kudos: { label: 'Благодарность', icon: Heart, desc: 'Отправить kudos коллеге' },
    'top-kudos': { label: 'Топ Kudos', icon: Trophy, desc: 'Рейтинг по благодарностям' },
    cta: { label: 'Кнопка (CTA)', icon: MousePointerClick, desc: 'Кнопка перехода в МИРУ' },
  };

  const ctaTargetOptions = [
    { value: '/', label: 'Главная' },
    { value: '/feedback/new', label: 'Оставить отзыв' },
    { value: '/surveys', label: 'Опросы' },
    { value: '/kudos/new', label: 'Благодарности' },
    { value: '/dashboard', label: 'Аналитика' },
    { value: '/settings', label: 'Настройки' },
    { value: 'custom', label: 'Произвольный путь...' },
  ];

  return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <h1 className="text-2xl font-bold mb-1">Встраивание</h1>
        <p className="text-muted-foreground mb-6">Получите код для размещения на внешнем сайте</p>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : (
          <div className="space-y-6">
            {/* Embed type selector */}
            <Card>
              <CardHeader><CardTitle className="text-base">Тип встраивания</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {(Object.entries(embedTypeLabels) as [EmbedType, typeof embedTypeLabels.survey][]).map(([type, info]) => {
                    const Icon = info.icon;
                    return (
                      <button key={type} onClick={() => setEmbedType(type)}
                        className={`p-4 rounded-lg border text-left transition-all ${embedType === type ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted'}`}>
                        <Icon size={20} className="mb-2 text-primary" />
                        <p className="font-medium text-sm">{info.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader><CardTitle className="text-base">Настройки</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {embedType === 'survey' && (
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
                  )}
                  {embedType === 'feedback' && (
                    <div>
                      <Label>Эпизод</Label>
                      <Select value={selectedEpisodeId} onValueChange={setSelectedEpisodeId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {episodes.map(ep => (
                            <SelectItem key={ep.id} value={ep.id}>{ep.title} ({ep.date})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {embedType === 'top-kudos' && (
                    <>
                      <div>
                        <Label>Период</Label>
                        <Select value={kudosPeriod} onValueChange={(v: '7d' | '30d' | '90d') => setKudosPeriod(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7d">7 дней</SelectItem>
                            <SelectItem value="30d">30 дней</SelectItem>
                            <SelectItem value="90d">90 дней</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Команда</Label>
                        <Select value={kudosTeam} onValueChange={setKudosTeam}>
                          <SelectTrigger><SelectValue placeholder="Все" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Все команды</SelectItem>
                            {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Показывать</Label>
                        <Select value={kudosLimit} onValueChange={(v: '5' | '10') => setKudosLimit(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5">Топ 5</SelectItem>
                            <SelectItem value="10">Топ 10</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {embedType === 'cta' && (
                    <>
                      <div>
                        <Label>Текст кнопки</Label>
                        <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Перейти в МИРУ" />
                      </div>
                      <div>
                        <Label>Подпись (необязательно)</Label>
                        <Input value={ctaSubtitle} onChange={e => setCtaSubtitle(e.target.value)} placeholder="Оставьте отзыв коллеге" />
                      </div>
                      <div>
                        <Label>Целевая страница</Label>
                        <Select value={ctaTarget} onValueChange={setCtaTarget}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ctaTargetOptions.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {ctaTarget === 'custom' && (
                        <div>
                          <Label>Путь</Label>
                          <Input value={ctaCustomPath} onChange={e => setCtaCustomPath(e.target.value)} placeholder="/my-page" />
                        </div>
                      )}
                      <div>
                        <Label>Размер</Label>
                        <Select value={ctaSize} onValueChange={(v: 's' | 'm' | 'l') => setCtaSize(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="s">Маленький (S)</SelectItem>
                            <SelectItem value="m">Средний (M)</SelectItem>
                            <SelectItem value="l">Большой (L)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Стиль</Label>
                        <Select value={ctaStyle} onValueChange={(v: 'primary' | 'secondary' | 'outline') => setCtaStyle(v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary">Primary</SelectItem>
                            <SelectItem value="secondary">Secondary</SelectItem>
                            <SelectItem value="outline">Outline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <Switch checked={ctaNewTab} onCheckedChange={setCtaNewTab} id="cta-newtab" />
                        <Label htmlFor="cta-newtab" className="text-sm">Открывать в новой вкладке</Label>
                      </div>
                    </>
                  )}
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
                    height={embedType === 'cta' ? 120 : 500}
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
                <div className="relative">
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap">{generateIframeCode()}</pre>
                  <Button size="sm" variant="ghost" className="absolute top-2 right-2" onClick={() => copyToClipboard(generateIframeCode())}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {embedType === 'cta'
                    ? 'Вставьте код на HTML-страницу. Кнопка откроет МИРУ в выбранном разделе.'
                    : 'Вставьте код на HTML-страницу. Все ответы будут помечены source: "embed".'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}
