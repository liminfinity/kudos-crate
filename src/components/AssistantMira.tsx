import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import miraAvatar from '@/assets/mira-avatar.png';

type Message = { role: 'user' | 'assistant'; content: string };

const ONBOARDING_KEY = 'mira_onboarding_shown';
const CHAT_STATE_KEY = 'mira_chat_open';

const WELCOME_MESSAGES: Record<string, string> = {
  employee: 'Привет! Я МИРА — ваш цифровой ассистент. Помогу разобраться с обратной связью, благодарностями и опросами. Спрашивайте.',
  manager: 'Привет! Я МИРА — ваш ассистент. Помогу с аналитикой команды и дневником руководителя.',
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

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка соединения');
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || 'Нет ответа';
      setMessages(prev => [...prev, { role: 'assistant', content }]);
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
        <div className="fixed bottom-20 right-4 z-50 max-w-xs animate-fade-in">
          <div className="bg-card border border-border rounded-lg shadow-lg p-4 relative">
            <button onClick={() => setShowOnboarding(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
            <div className="flex items-start gap-3">
              <img src={miraAvatar} alt="МИРА" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Привет! Я МИРА</p>
                <p className="text-xs text-muted-foreground mt-1">Ваш ассистент на платформе. Нажмите, чтобы задать вопрос.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-card border border-border rounded-xl shadow-2xl flex flex-col animate-fade-in">
          <div className="flex items-center gap-3 p-4 border-b border-border flex-shrink-0">
            <img src={miraAvatar} alt="МИРА" className="w-9 h-9 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">МИРА</p>
              <p className="text-xs text-muted-foreground">Цифровой ассистент</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-8 w-8">
              <X size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <img src={miraAvatar} alt="МИРА" className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" />
                )}
                <div className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
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
                <img src={miraAvatar} alt="МИРА" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles size={14} className="animate-pulse" />
                    МИРА думает...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите МИРУ..."
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[40px] max-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                rows={1}
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim() || isLoading} className="h-10 w-10 flex-shrink-0">
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { setOpen(!open); setShowOnboarding(false); }}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 overflow-hidden border-2 border-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <img src={miraAvatar} alt="МИРА — цифровой ассистент" className="w-full h-full object-cover" />
      </button>
    </>
  );
}
