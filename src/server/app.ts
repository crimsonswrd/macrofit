import { startApp } from 'modelence/server';
import demoAuthModule from '@/server/demoAuth';
import nutritionModule from '@/server/nutrition';
import profileModule from '@/server/profile';
import targetsModule from '@/server/targets';
import foodsModule from '@/server/foods';
import weightModule from '@/server/weight';
import { createDemoUser, disableProductionDemoUser } from '@/server/migrations/demoAuth';
import { seedFoodDatabase } from '@/server/migrations/seedFoods';
import { backfillFoodEntrySnapshots } from '@/server/migrations/backfillFoodEntrySnapshots';
import { backfillFoodEntrySources } from '@/server/migrations/backfillFoodEntrySources';

startApp({
  modules: [demoAuthModule, profileModule, targetsModule, foodsModule, nutritionModule, weightModule],

  roles: {
    foodModerator: { description: 'Can approve or reject public food catalog submissions' },
  },

  security: {
    frameAncestors: ['https://modelence.com', 'https://*.modelence.com', 'http://localhost:*', 'https://*.exp.direct'],
  },

  migrations: [
    {
      version: 1,
      description: 'Create demo user',
      handler: createDemoUser,
    },
    {
      version: 2,
      description: 'Seed curated food database',
      handler: seedFoodDatabase,
    },
    {
      version: 3,
      description: 'Disable legacy demo account outside demo environments',
      handler: disableProductionDemoUser,
    },
    {
      version: 4,
      description: 'Backfill immutable diary macro snapshots',
      handler: backfillFoodEntrySnapshots,
    },
    {
      version: 5,
      description: 'Mark legacy diary entries as catalog foods',
      handler: backfillFoodEntrySources,
    },
  ],
});
