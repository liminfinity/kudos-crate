import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmbedCta() {
  const params = new URLSearchParams(window.location.search);
  const label = params.get('label') || 'Перейти в МИРУ';
  const subtitle = params.get('subtitle') || '';
  const target = params.get('target') || '/';
  const theme = params.get('theme') || 'light';
  const size = params.get('size') || 'm';
  const style = params.get('style') || 'primary';
  const newTab = params.get('newTab') !== 'false';

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  // Build full URL for the target
  const baseUrl = window.location.origin;
  const targetUrl = target.startsWith('http') ? target : `${baseUrl}${target}`;

  const sizeClasses: Record<string, string> = {
    s: 'text-sm px-4 py-2',
    m: 'text-base px-6 py-3',
    l: 'text-lg px-8 py-4',
  };

  const variant = style === 'outline' ? 'outline' : style === 'secondary' ? 'secondary' : 'default';

  return (
    <div className="flex flex-col items-center justify-center min-h-[80px] p-4 font-sans">
      <a
        href={targetUrl}
        target={newTab ? '_blank' : '_self'}
        rel={newTab ? 'noopener noreferrer' : undefined}
        aria-label={label}
        className="no-underline"
      >
        <Button
          variant={variant}
          className={cn(
            sizeClasses[size] || sizeClasses.m,
            'gap-2 font-medium rounded-lg shadow-sm hover:shadow-md transition-shadow'
          )}
          asChild={false}
        >
          {label}
          {newTab && <ExternalLink size={size === 's' ? 14 : size === 'l' ? 18 : 16} />}
        </Button>
      </a>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-2 text-center">{subtitle}</p>
      )}
    </div>
  );
}
