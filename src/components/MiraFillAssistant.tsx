import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import miraAvatar from '@/assets/mira-avatar.png';
import { supabase } from '@/integrations/supabase/client';

interface MiraFillAssistantProps {
  context: string; // e.g. "feedback" | "survey"
  onResult: (text: string) => void;
}

interface Message {
  role: 'mira' | 'user';
  text: string;
}

const INITIAL_QUESTIONS: Record<string, string[]> = {
  feedback: [
    'Что конкретно произошло? Опишите ситуацию в 1–2 предложениях.',
    'Это было разовое событие или происходит регулярно?',
    'Как это повлияло на работу — вашу или команды?',
  ],
  survey: [
    'Какие ключевые задачи вы выполняли в этот период?',
    'Что получилось лучше всего?',
    'Что было сложнее всего и почему?',
  ],
};

export function MiraFillAssistant({ context, onResult }: MiraFillAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');

  const questions = INITIAL_QUESTIONS[context] || INITIAL_QUESTIONS.feedback;

  function startDialog() {
    setMessages([{ role: 'mira', text: questions[0] }]);
    setCurrentQ(0);
    setUserInput('');
    setResult('');
  }

  async function handleSend() {
    if (!userInput.trim()) return;
    const newMessages = [...messages, { role: 'user' as const, text: userInput }];
    setUserInput('');

    const nextQ = currentQ + 1;
    if (nextQ < questions.length) {
      newMessages.push({ role: 'mira', text: questions[nextQ] });
      setMessages(newMessages);
      setCurrentQ(nextQ);
    } else {
      setMessages(newMessages);
      // Generate final text
      setGenerating(true);
      try {
        const userAnswers = newMessages
          .filter(m => m.role === 'user')
          .map((m, i) => `Вопрос: ${questions[i]}\nОтвет: ${m.text}`)
          .join('\n\n');

        const { data } = await supabase.functions.invoke('assistant', {
          body: {
            message: `На основе ответов пользователя сформулируй структурированный, профессиональный текст для ${context === 'feedback' ? 'отзыва о коллеге' : 'полугодового опроса'}. Текст должен быть от первого лица, конкретным, без воды. Максимум 3-4 предложения.\n\nОтветы:\n${userAnswers}`,
          },
        });

        const generatedText = data?.reply || newMessages.filter(m => m.role === 'user').map(m => m.text).join('. ');
        setResult(generatedText);
        setMessages([...newMessages, { role: 'mira', text: `Вот что получилось:\n\n«${generatedText}»\n\nМожете использовать как есть или отредактировать.` }]);
      } catch {
        const fallback = newMessages.filter(m => m.role === 'user').map(m => m.text).join('. ');
        setResult(fallback);
        setMessages([...newMessages, { role: 'mira', text: `Я объединила ваши ответы:\n\n«${fallback}»` }]);
      }
      setGenerating(false);
    }
  }

  function handleAccept() {
    if (result) {
      onResult(result);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) startDialog(); }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 text-accent border-accent/30 hover:bg-accent/10">
          <Sparkles size={14} />
          Помочь сформулировать
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={miraAvatar} alt="МИРА" className="w-6 h-6 rounded-full" />
            Заполнить с Мирой
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto py-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'mira' && (
                <img src={miraAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-1" />
              )}
              <div className={`rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                m.role === 'mira'
                  ? 'bg-accent/10 text-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {generating && (
            <div className="flex gap-2">
              <img src={miraAvatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-1" />
              <div className="rounded-lg px-3 py-2 text-sm bg-accent/10 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Формулирую текст...
              </div>
            </div>
          )}
        </div>

        {!result ? (
          <div className="flex gap-2">
            <Textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="Ваш ответ..."
              rows={2}
              className="flex-1"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button size="icon" onClick={handleSend} disabled={!userInput.trim() || generating}>
              <Send size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleAccept} className="flex-1 gap-1.5">
              <Sparkles size={14} />
              Использовать текст
            </Button>
            <Button variant="outline" onClick={() => { setResult(''); startDialog(); }}>
              Начать заново
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
