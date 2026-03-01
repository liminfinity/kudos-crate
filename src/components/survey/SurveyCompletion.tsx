import { CheckCircle2, PartyPopper, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SurveyCompletionProps {
  title?: string;
  subtitle?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function SurveyCompletion({
  title = 'Спасибо за участие!',
  subtitle = 'Ваш ответ принят. Мы ценим ваше мнение.',
  onAction,
  actionLabel,
}: SurveyCompletionProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-fade-in">
      {/* Decorative elements */}
      <div className="relative mb-8">
        <div className="absolute -top-3 -left-3 text-chart-4 animate-bounce" style={{ animationDelay: '0.1s' }}>
          <Sparkles size={20} />
        </div>
        <div className="absolute -top-2 -right-4 text-accent animate-bounce" style={{ animationDelay: '0.3s' }}>
          <PartyPopper size={18} />
        </div>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-positive/10 border border-positive/20">
          <CheckCircle2 size={40} className="text-positive" />
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-sm">{subtitle}</p>

      {onAction && actionLabel && (
        <Button onClick={onAction} className="mt-6">{actionLabel}</Button>
      )}
    </div>
  );
}
