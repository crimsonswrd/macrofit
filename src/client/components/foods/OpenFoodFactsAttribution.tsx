import { ExternalLink } from 'lucide-react';
import { cn } from '@/client/lib/utils';

export function OpenFoodFactsAttribution({ className }: { className?: string }) {
  return (
    <p className={cn('text-xs leading-relaxed text-ink-3', className)}>
      Данные: {' '}
      <a
        href="https://world.openfoodfacts.org/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-ink-2 underline decoration-mist-2 underline-offset-2 hover:text-flame-500"
      >
        Open Food Facts <ExternalLink className="size-3" aria-hidden="true" />
      </a>{' '}
      — база доступна по лицензии{' '}
      <a
        href="https://opendatacommons.org/licenses/odbl/1-0/"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-ink-2 underline decoration-mist-2 underline-offset-2 hover:text-flame-500"
      >
        ODbL
      </a>.
    </p>
  );
}
