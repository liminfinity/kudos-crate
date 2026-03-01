import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { X, Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import miraAvatar from '@/assets/mira-avatar.png';

type Message = { role: 'user' | 'assistant'; content: string };

const ONBOARDING_KEY = 'mira_onboarding_shown';
const CHAT_STATE_KEY = 'mira_chat_open';

const WELCOME_MESSAGES: Record<string, string> = {
  employee: 'Привет! Я МИРА — ваш ассистент. Помогу разобраться с обратной связью, благодарностями и опросами.',
  manager: 'Привет! Я МИРА. Помогу с аналитикой команды и дневником руководителя.',
  hr: 'Привет! Я МИРА. Помогу с аналитикой, сигналами и интерпретацией данных.',
  admin: 'Привет! Я МИРА. Помогу с любыми вопросами по платформе.',
};

export function AssistantMira() {
  const { role } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(() => localStorage.getItem(CHAT_STATE_KEY) === 'true');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY) && role) {
      setShowOnboarding(true);
      localStorage.setItem(ONBOARDING_KEY, 'true');
    }
  }, [role]);

  useEffect(() => { localStorage.setItem(CHAT_STATE_KEY, String(open)); }, [open]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (messages.length === 0 && role) {
      setMessages([{ role: 'assistant', content: WELCOME_MESSAGES[role] || WELCOME_MESSAGES.employee }]);
    }
  }, [role]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          user_role: role || 'employee',
          current_page: location.pathname,
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка соединения');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant' && prev.length > newMessages.length) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Извините, произошла ошибка: ${e instanceof Error ? e.message : 'попробуйте позже'}`
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, role, location.pathname]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Onboarding tooltip */}
      {showOnboarding && !open && (
        <div className="fixed bottom-16 right-4 z-50 max-w-[220px]">
          <div className="bg-card border rounded-lg shadow-card-hover p-3 relative">
            <button onClick={() => setShowOnboarding(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors duration-150">
              <X size={12} />
            </button>
            <p className="text-xs text-muted-foreground pr-4">Я МИРА — ваш ассистент. Нажмите, чтобы задать вопрос.</p>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-14 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)] h-[440px] max-h-[calc(100vh-5rem)] bg-card border rounded-lg shadow-card-hover flex flex-col">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b flex-shrink-0">
            <img src={miraAvatar} alt="МИРА" className="w-7 h-7 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">МИРА</p>
              <p className="text-[10px] text-muted-foreground">Ассистент</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-7 w-7">
              <X size={14} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-2 items-start">
                <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  МИРА думает...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-2.5 border-t flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите МИРУ..."
                className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-xs min-h-[36px] max-h-[72px] focus:outline-none focus:ring-1 focus:ring-ring transition-colors duration-150"
                rows={1}
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isLoading} className="h-9 w-9 flex-shrink-0">
                <Send size={14} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(!open); setShowOnboarding(false); }}
        className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-card-hover hover:shadow-lg transition-shadow duration-150 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {open ? <X size={16} /> : <MessageCircle size={16} />}
      </button>
    </>
  );
}
