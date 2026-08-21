import { cn } from '@/client/lib/utils';
import {
  FOOD_SOURCE_LABELS,
  SUBMISSION_STATUS_LABELS,
  type FoodSource,
  type SubmissionStatus,
} from '@/client/lib/foods';

const statusClasses: Record<SubmissionStatus, string> = {
  pending: 'border-carb/40 bg-carb/10 text-carb',
  approved: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-flame-500/40 bg-flame-500/10 text-flame-500',
  withdrawn: 'border-mist-2 bg-mist text-ink-3',
};

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-bold', statusClasses[status])}>
      {SUBMISSION_STATUS_LABELS[status]}
    </span>
  );
}

export function FoodSourceBadge({ source }: { source: FoodSource }) {
  return (
    <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-mist-2 bg-mist px-2 py-0.5 text-[11px] font-semibold text-ink-3">
      {FOOD_SOURCE_LABELS[source]}
    </span>
  );
}
