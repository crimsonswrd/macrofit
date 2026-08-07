import type { ReactNode } from 'react';
import { cn } from '@/client/lib/utils';

interface QuestionSectionProps {
  number: number;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function QuestionSection({ number, title, description, children, className }: QuestionSectionProps) {
  return (
    <section className={cn('rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6', className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-flame-50 font-display text-sm font-bold text-flame-500">
          {number}
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold uppercase tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-3">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

interface ChoiceGridProps<T extends string> {
  name: string;
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; hint?: string }>;
  columns?: 2 | 3;
}

export function ChoiceGrid<T extends string>({ name, legend, value, onChange, options, columns = 2 }: ChoiceGridProps<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className={cn('grid gap-2', columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-flame-500 focus-within:ring-offset-2 focus-within:ring-offset-mist',
              value === option.value
                ? 'border-flame-500 bg-flame-50 text-ink'
                : 'border-mist-2 bg-mist/50 text-ink-2 hover:border-ink-3'
            )}
          >
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="block text-sm font-bold">{option.label}</span>
            {option.hint && <span className="mt-1 block text-xs leading-relaxed text-ink-3">{option.hint}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
