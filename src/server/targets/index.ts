import z from 'zod';
import { AuthError } from 'modelence';
import { Module, ObjectId, type UserInfo } from 'modelence/server';
import { dbTargetHistory } from './db';
import { buildPreview, confirmPreview, serializeTarget } from './service';
import {
  acceptAdjustmentProposal,
  dismissAdjustmentProposal,
  getOpenProposal,
  serializeProposal,
} from '@/server/weight/service';
import { objectIdSchema } from '@/server/nutrition/validation';

function requireUser(user: UserInfo | null): UserInfo {
  if (!user) throw new AuthError('Требуется вход в аккаунт');
  return user;
}

export default new Module('targets', {
  stores: [dbTargetHistory],

  queries: {
    getCurrent: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const [target] = await dbTargetHistory.fetch(
        { userId: new ObjectId(currentUser.id) },
        { sort: { effectiveFrom: -1, createdAt: -1 }, limit: 1 },
      );
      return target ? serializeTarget(target) : null;
    },

    listHistory: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const targets = await dbTargetHistory.fetch(
        { userId: new ObjectId(currentUser.id) },
        { sort: { effectiveFrom: -1, createdAt: -1 }, limit: 100 },
      );
      return targets.map(serializeTarget);
    },

    getOpenProposal: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const proposal = await getOpenProposal(new ObjectId(currentUser.id));
      return proposal ? serializeProposal(proposal) : null;
    },
  },

  mutations: {
    preview: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      return buildPreview(new ObjectId(currentUser.id));
    },

    confirmPreview: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { profileRevision } = z.object({ profileRevision: z.number().int().positive() }).parse(args);
      return confirmPreview(new ObjectId(currentUser.id), profileRevision);
    },

    acceptProposal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { proposalId } = z.object({ proposalId: objectIdSchema }).parse(args);
      const target = await acceptAdjustmentProposal(
        new ObjectId(currentUser.id),
        new ObjectId(proposalId),
      );
      return serializeTarget(target);
    },

    dismissProposal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { proposalId } = z.object({ proposalId: objectIdSchema }).parse(args);
      const proposal = await dismissAdjustmentProposal(
        new ObjectId(currentUser.id),
        new ObjectId(proposalId),
      );
      return serializeProposal(proposal);
    },
  },
});
