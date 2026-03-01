import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type TextContext = 'feedback' | 'critical' | 'kudos' | 'survey' | 'manager-diary';

interface ProcessResult {
  status: 'OK' | 'INVALID';
  processed_text: string;
  toxicity_score: number;
  was_modified: boolean;
}

export function useTextProcessor() {
  const [processing, setProcessing] = useState(false);

  const processText = useCallback(async (
    text: string,
    context: TextContext
  ): Promise<ProcessResult | null> => {
    if (!text || text.trim().length < 3) {
      return { status: 'OK', processed_text: text, toxicity_score: 0, was_modified: false };
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-text', {
        body: { text, context },
      });

      if (error) {
        console.error('Text processing error:', error);
        toast({ title: 'Не удалось проверить текст', description: 'Текст будет отправлен без проверки', variant: 'destructive' });
        return { status: 'OK', processed_text: text, toxicity_score: 0, was_modified: false };
      }

      if (data.error) {
        toast({ title: 'Ошибка проверки текста', description: data.error, variant: 'destructive' });
        return { status: 'OK', processed_text: text, toxicity_score: 0, was_modified: false };
      }

      const result = data as ProcessResult;

      if (result.status === 'INVALID') {
        toast({
          title: 'Текст не прошёл проверку',
          description: 'Комментарий выглядит бессмысленным. Пожалуйста, уточните формулировку.',
          variant: 'destructive',
        });
        return result;
      }

      if (result.toxicity_score > 0.7) {
        toast({
          title: '⚠️ Обнаружена токсичность',
          description: 'Текст содержит неприемлемые выражения и был автоматически скорректирован.',
          variant: 'destructive',
        });
      } else if (result.was_modified) {
        toast({
          title: '✨ Текст улучшен',
          description: 'Текст был автоматически улучшен (орфография, формулировки).',
        });
      }

      return result;
    } catch (e) {
      console.error('Text processor error:', e);
      return { status: 'OK', processed_text: text, toxicity_score: 0, was_modified: false };
    } finally {
      setProcessing(false);
    }
  }, []);

  return { processText, processing };
}
