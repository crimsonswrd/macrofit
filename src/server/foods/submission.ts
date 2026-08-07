import type { SubmissionStatus } from '@/shared/contracts/food';

export function buildSubmissionKey(personalFoodId: string): string {
  return `pending:${personalFoodId.toLowerCase()}`;
}

export function pendingSubmissionUpsert<T extends Record<string, unknown>>(
  personalFoodId: string,
  immutableSnapshot: T,
) {
  const submissionKey = buildSubmissionKey(personalFoodId);
  return {
    selector: { submissionKey },
    update: {
      $setOnInsert: {
        ...immutableSnapshot,
        submissionKey,
        status: 'pending' as const,
      },
    },
  };
}

type ApprovalRecord = {
  status: SubmissionStatus;
  approvedCatalogFoodId?: unknown;
};

/** Existing fully-published approvals are returned unchanged and perform no repair writes. */
export async function resolveApprovedRetry<T extends ApprovalRecord>(
  submission: T,
  repair: (submission: T) => Promise<T>,
): Promise<T> {
  if (submission.status === 'approved' && submission.approvedCatalogFoodId) return submission;
  return repair(submission);
}
