import z from 'zod';
import { ValidationError } from 'modelence';
import { Module, ObjectId, type UserInfo } from 'modelence/server';
import { FOOD_UNITS } from '@/shared/contracts/food';
import { dbFoods } from '@/server/nutrition/db';
import { objectIdSchema } from '@/server/nutrition/validation';
import { normalizeBarcode } from './barcode';
import { dbBarcodeCache, dbBarcodeMappings, dbFoodImportGrants, dbFoodSubmissions, dbPersonalFoods } from './db';
import {
  applyConfirmedOffImport,
  isRetrySafeDecision,
  lookupBarcodeForUser,
  requireFoodModerator,
  requireUser,
  serializePersonalFood,
  serializeSubmission,
  resolveOffImportProvenance,
  ownerScopedPersonalFoodSelector,
} from './service';
import { pendingSubmissionUpsert, resolveApprovedRetry } from './submission';

const foodInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().max(120).optional(),
  category: z.string().trim().min(1).max(80).default('Другое'),
  calories: z.number().min(0).max(1_000),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  unit: z.enum(FOOD_UNITS).default('г'),
  barcode: z.string().trim().optional(),
  importToken: z.string().uuid().optional(),
});

function parseFoodInput(args: unknown) {
  const input = foodInputSchema.parse(args);
  if (!input.barcode) return { ...input, barcode: undefined };
  const barcode = normalizeBarcode(input.barcode);
  if (!barcode) throw new ValidationError('Некорректный штрихкод EAN-8, UPC-A или EAN-13');
  return { ...input, barcode: barcode.value };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function approveSubmission(
  submission: typeof dbFoodSubmissions._doc,
  moderatorId: ObjectId,
  reviewNote: string | undefined,
) {
  const now = new Date();
  const claimed = await dbFoodSubmissions.findOneAndUpdate(
    { _id: submission._id, status: 'pending' },
    {
      $set: {
        status: 'approved',
        reviewedAt: now,
        reviewedBy: moderatorId,
        reviewNote,
      },
      $unset: { submissionKey: '' },
    },
    { returnDocument: 'after' },
  );
  const current = claimed ?? (await dbFoodSubmissions.requireById(submission._id));
  if (current.status !== 'approved') return null;

  const existingBarcodeMapping = submission.barcode
    ? await dbBarcodeMappings.findOne({ barcode: submission.barcode, source: 'catalog' })
    : null;
  let catalogFood = existingBarcodeMapping
    ? await dbFoods.findById(existingBarcodeMapping.foodId)
    : await dbFoods.findOne({ name: submission.name });
  if (!catalogFood) {
    await dbFoods.upsertOne(
      { name: submission.name },
      {
        $setOnInsert: {
          name: submission.name,
          brand: submission.brand,
          searchName: submission.searchName,
          category: submission.category,
          calories: submission.calories,
          protein: submission.protein,
          carbs: submission.carbs,
          fat: submission.fat,
          unit: submission.unit,
          isVerified: true,
          dataSource: submission.dataSource ?? 'Одобренная пользовательская заявка',
          dataQualityWarnings: submission.dataQualityWarnings,
          createdAt: now,
        },
      },
    );
    catalogFood = await dbFoods.requireOne({ name: submission.name });
  }

  if (submission.barcode) {
    await dbBarcodeMappings.upsertOne(
      { barcode: submission.barcode, source: 'catalog' },
      {
        $set: { foodId: catalogFood._id, updatedAt: now },
        $setOnInsert: {
          barcode: submission.barcode,
          source: 'catalog',
          createdAt: now,
        },
      },
    );
  }

  return dbFoodSubmissions.findOneAndUpdate(
    { _id: submission._id, status: 'approved' },
    {
      $set: {
        approvedCatalogFoodId: catalogFood._id,
      },
    },
    { returnDocument: 'after' },
  );
}

export default new Module('foods', {
  stores: [dbPersonalFoods, dbFoodSubmissions, dbBarcodeMappings, dbBarcodeCache, dbFoodImportGrants],

  queries: {
    searchPersonal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { query, limit } = z
        .object({ query: z.string().optional().default(''), limit: z.number().int().min(1).max(100).default(40) })
        .parse(args ?? {});
      const filter: Parameters<typeof dbPersonalFoods.fetch>[0] = {
        ownerId: new ObjectId(currentUser.id),
        deletedAt: { $exists: false },
      };
      const search = query.trim().toLowerCase();
      if (search) filter.searchName = { $regex: escapeRegex(search) };
      const foods = await dbPersonalFoods.fetch(filter, { sort: { name: 1 }, limit });
      return foods.map(serializePersonalFood);
    },

    lookupBarcode: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { barcode } = z.object({ barcode: z.string().min(1).max(64) }).parse(args);
      return lookupBarcodeForUser(barcode, new ObjectId(currentUser.id));
    },

    getMySubmissions: async (_args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const submissions = await dbFoodSubmissions.fetch(
        { submitterId: new ObjectId(currentUser.id) },
        { sort: { submittedAt: -1 }, limit: 100 },
      );
      return submissions.map(serializeSubmission);
    },

    getModerationQueue: async (args: unknown, { user }: { user: UserInfo | null }) => {
      requireFoodModerator(user);
      const { limit } = z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(args ?? {});
      const submissions = await dbFoodSubmissions.fetch(
        { status: 'pending' },
        { sort: { submittedAt: 1 }, limit },
      );
      return submissions.map(serializeSubmission);
    },
  },

  mutations: {
    createPersonal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const input = parseFoodInput(args);
      const { importToken, ...foodInput } = input;
      const ownerId = new ObjectId(currentUser.id);
      if (foodInput.barcode) {
        const existing = await dbPersonalFoods.findOne({
          ownerId,
          barcode: foodInput.barcode,
          deletedAt: { $exists: false },
        });
        if (existing) throw new ValidationError('Личный продукт с этим штрихкодом уже существует');
      }
      const now = new Date();
      const offImport = await resolveOffImportProvenance(foodInput.barcode, importToken, ownerId, now);
      const resolvedFoodInput = applyConfirmedOffImport(foodInput, offImport);
      const personalFood = await dbPersonalFoods.create({
        ownerId,
        ...resolvedFoodInput,
        searchName: resolvedFoodInput.name.toLowerCase(),
        ...(offImport
          ? { dataSource: offImport.dataSource, dataQualityWarnings: offImport.dataQualityWarnings }
          : {}),
        createdAt: now,
        updatedAt: now,
      });
      if (foodInput.barcode) {
        await dbBarcodeMappings.upsertOne(
          { barcode: foodInput.barcode, source: 'personal', ownerId },
          {
            $set: { foodId: personalFood._id, updatedAt: now },
            $setOnInsert: {
              barcode: foodInput.barcode,
              source: 'personal',
              ownerId,
              createdAt: now,
            },
          },
        );
      }
      return { id: personalFood._id.toString() };
    },

    updatePersonal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const parsed = z.object({ id: objectIdSchema, food: z.unknown() }).parse(args);
      const input = parseFoodInput(parsed.food);
      const { importToken, ...foodInput } = input;
      const ownerId = new ObjectId(currentUser.id);
      const personalFood = await dbPersonalFoods.requireOne({
        ...ownerScopedPersonalFoodSelector(new ObjectId(parsed.id), ownerId),
      });
      if (foodInput.barcode) {
        const duplicate = await dbPersonalFoods.findOne({
          _id: { $ne: personalFood._id },
          ownerId,
          barcode: foodInput.barcode,
          deletedAt: { $exists: false },
        });
        if (duplicate) throw new ValidationError('Личный продукт с этим штрихкодом уже существует');
      }
      const now = new Date();
      const offImport = await resolveOffImportProvenance(foodInput.barcode, importToken, ownerId, now);
      const resolvedFoodInput = applyConfirmedOffImport(foodInput, offImport);
      const requiredFields = {
        name: resolvedFoodInput.name,
        searchName: resolvedFoodInput.name.toLowerCase(),
        category: resolvedFoodInput.category,
        calories: resolvedFoodInput.calories,
        protein: resolvedFoodInput.protein,
        carbs: resolvedFoodInput.carbs,
        fat: resolvedFoodInput.fat,
        unit: resolvedFoodInput.unit,
        updatedAt: now,
      };
      let foodUpdate: Parameters<typeof dbPersonalFoods.updateOne>[1];
      if (resolvedFoodInput.barcode && resolvedFoodInput.brand) {
        foodUpdate = { $set: { ...requiredFields, barcode: resolvedFoodInput.barcode, brand: resolvedFoodInput.brand } };
      } else if (resolvedFoodInput.barcode) {
        foodUpdate = { $set: { ...requiredFields, barcode: resolvedFoodInput.barcode }, $unset: { brand: '' } };
      } else if (resolvedFoodInput.brand) {
        foodUpdate = { $set: { ...requiredFields, brand: resolvedFoodInput.brand }, $unset: { barcode: '' } };
      } else {
        foodUpdate = { $set: requiredFields, $unset: { barcode: '', brand: '' } };
      }
      await dbPersonalFoods.updateOne(
        { _id: personalFood._id, ownerId },
        foodUpdate,
      );
      await dbPersonalFoods.updateOne(
        { _id: personalFood._id, ownerId },
        offImport
          ? { $set: { dataSource: offImport.dataSource, dataQualityWarnings: offImport.dataQualityWarnings } }
          : { $unset: { dataSource: '', dataQualityWarnings: '' } },
      );
      if (personalFood.barcode && personalFood.barcode !== resolvedFoodInput.barcode) {
        await dbBarcodeMappings.deleteOne({
          barcode: personalFood.barcode,
          source: 'personal',
          ownerId,
          foodId: personalFood._id,
        });
      }
      if (resolvedFoodInput.barcode) {
        await dbBarcodeMappings.upsertOne(
          { barcode: resolvedFoodInput.barcode, source: 'personal', ownerId },
          {
            $set: { foodId: personalFood._id, updatedAt: now },
            $setOnInsert: { barcode: resolvedFoodInput.barcode, source: 'personal', ownerId, createdAt: now },
          },
        );
      }
    },

    archivePersonal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { id, foodId } = z
        .object({ id: objectIdSchema.optional(), foodId: objectIdSchema.optional() })
        .refine((value) => Boolean(value.id ?? value.foodId), { message: 'Укажите продукт' })
        .parse(args);
      const personalFoodId = id ?? foodId;
      if (!personalFoodId) throw new ValidationError('Укажите продукт');
      const ownerId = new ObjectId(currentUser.id);
      const personalFood = await dbPersonalFoods.requireOne(
        ownerScopedPersonalFoodSelector(new ObjectId(personalFoodId), ownerId, false),
      );
      if (personalFood.deletedAt) return { id: personalFoodId };

      const now = new Date();
      await dbPersonalFoods.updateOne(
        { _id: personalFood._id, ownerId, deletedAt: { $exists: false } },
        { $set: { deletedAt: now, updatedAt: now } },
      );
      if (personalFood.barcode) {
        await dbBarcodeMappings.deleteOne({
          barcode: personalFood.barcode,
          source: 'personal',
          ownerId,
          foodId: personalFood._id,
        });
      }
      return { id: personalFoodId };
    },

    submitPersonal: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { personalFoodId } = z.object({ personalFoodId: objectIdSchema }).parse(args);
      const submitterId = new ObjectId(currentUser.id);
      const food = await dbPersonalFoods.requireOne({
        ...ownerScopedPersonalFoodSelector(new ObjectId(personalFoodId), submitterId),
      });
      const snapshot = {
        submitterId,
        personalFoodId: food._id,
        name: food.name,
        searchName: food.searchName,
        brand: food.brand,
        category: food.category,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        unit: food.unit,
        barcode: food.barcode,
        dataSource: food.dataSource,
        dataQualityWarnings: food.dataQualityWarnings,
        submittedAt: new Date(),
      };
      const plan = pendingSubmissionUpsert(food._id.toString(), snapshot);
      const { doc: submission } = await dbFoodSubmissions.findOneAndUpsert(
        plan.selector,
        plan.update,
        { upsert: true },
      );
      if (!submission) throw new Error('Не удалось создать заявку');
      return serializeSubmission(submission);
    },

    withdrawSubmission: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const currentUser = requireUser(user);
      const { submissionId } = z.object({ submissionId: objectIdSchema }).parse(args);
      const submission = await dbFoodSubmissions.findOneAndUpdate(
        {
          _id: new ObjectId(submissionId),
          submitterId: new ObjectId(currentUser.id),
          status: 'pending',
        },
        { $set: { status: 'withdrawn' }, $unset: { submissionKey: '' } },
        { returnDocument: 'after' },
      );
      if (submission) return serializeSubmission(submission);
      const current = await dbFoodSubmissions.requireOne({
        _id: new ObjectId(submissionId),
        submitterId: new ObjectId(currentUser.id),
      });
      return serializeSubmission(current);
    },

    moderateSubmission: async (args: unknown, { user }: { user: UserInfo | null }) => {
      const moderator = requireFoodModerator(user);
      const { submissionId, decision, reviewNote } = z
        .object({
          submissionId: objectIdSchema,
          decision: z.enum(['approved', 'rejected']),
          reviewNote: z.string().trim().max(500).optional(),
        })
        .superRefine((value, context) => {
          if (value.decision === 'rejected' && !value.reviewNote) {
            context.addIssue({ code: 'custom', path: ['reviewNote'], message: 'Укажите причину отклонения' });
          }
        })
        .parse(args);
      const submission = await dbFoodSubmissions.requireById(new ObjectId(submissionId));
      if (submission.status !== 'pending') {
        if (isRetrySafeDecision(submission.status, decision)) {
          if (decision === 'approved') {
            const resolved = await resolveApprovedRetry(submission, async (record) => {
              const repaired = await approveSubmission(record, new ObjectId(moderator.id), reviewNote);
              if (!repaired) throw new Error('Не удалось восстановить публикацию продукта');
              return repaired;
            });
            return serializeSubmission(resolved);
          }
          return serializeSubmission(submission);
        }
        throw new ValidationError(`Заявка уже имеет статус ${submission.status}`);
      }

      const moderatorId = new ObjectId(moderator.id);
      const updated =
        decision === 'approved'
          ? await approveSubmission(submission, moderatorId, reviewNote)
          : await dbFoodSubmissions.findOneAndUpdate(
              { _id: submission._id, status: 'pending' },
              {
                $set: {
                  status: 'rejected',
                  reviewedAt: new Date(),
                  reviewedBy: moderatorId,
                  reviewNote,
                },
                $unset: { submissionKey: '' },
              },
              { returnDocument: 'after' },
            );
      if (updated) return serializeSubmission(updated);

      const current = await dbFoodSubmissions.requireById(submission._id);
      if (isRetrySafeDecision(current.status, decision)) return serializeSubmission(current);
      throw new ValidationError(`Заявка уже имеет статус ${current.status}`);
    },
  },
});
