import { Store, schema } from 'modelence/server';
import { SUBMISSION_STATUSES } from '@/shared/contracts/food';

const foodSnapshotSchema = {
  name: schema.string(),
  searchName: schema.string(),
  brand: schema.string().optional(),
  category: schema.string(),
  calories: schema.number(),
  protein: schema.number(),
  carbs: schema.number(),
  fat: schema.number(),
  unit: schema.string(),
  barcode: schema.string().optional(),
  dataSource: schema.string().optional(),
  dataQualityWarnings: schema.array(schema.string()).optional(),
};

export const dbPersonalFoods = new Store('personalFoods', {
  schema: {
    ownerId: schema.userId(),
    ...foodSnapshotSchema,
    createdAt: schema.date(),
    updatedAt: schema.date(),
    deletedAt: schema.date().optional(),
  },
  indexes: [
    { key: { ownerId: 1, searchName: 1 } },
    { key: { ownerId: 1, barcode: 1 } },
  ],
});

export const dbFoodSubmissions = new Store('foodSubmissions', {
  schema: {
    /** Present only while pending; unique to make submission creation atomic. */
    submissionKey: schema.string().optional(),
    submitterId: schema.userId(),
    personalFoodId: schema.objectId(),
    ...foodSnapshotSchema,
    status: schema.enum(SUBMISSION_STATUSES),
    submittedAt: schema.date(),
    reviewedAt: schema.date().optional(),
    reviewedBy: schema.objectId().optional(),
    reviewNote: schema.string().optional(),
    approvedCatalogFoodId: schema.objectId().optional(),
  },
  indexes: [
    { key: { submitterId: 1, submittedAt: -1 } },
    { key: { status: 1, submittedAt: 1 } },
    { key: { personalFoodId: 1, status: 1 } },
    { key: { submissionKey: 1 }, unique: true, sparse: true },
  ],
});

export const dbBarcodeMappings = new Store('foodBarcodeMappings', {
  schema: {
    barcode: schema.string(),
    source: schema.enum(['catalog', 'personal']),
    foodId: schema.objectId(),
    ownerId: schema.objectId().optional(),
    createdAt: schema.date(),
    updatedAt: schema.date(),
  },
  indexes: [
    { key: { barcode: 1, source: 1, ownerId: 1 }, unique: true },
    { key: { foodId: 1 } },
  ],
});

export const dbBarcodeCache = new Store('foodBarcodeCache', {
  schema: {
    barcode: schema.string(),
    status: schema.enum(['found', 'not_found', 'incomplete']),
    name: schema.string().optional(),
    brand: schema.string().optional(),
    category: schema.string().optional(),
    calories: schema.number().optional(),
    protein: schema.number().optional(),
    carbs: schema.number().optional(),
    fat: schema.number().optional(),
    unit: schema.string().optional(),
    warnings: schema.array(schema.string()),
    fetchedAt: schema.date(),
    expiresAt: schema.date(),
    dataSource: schema.string(),
    /** Legacy cache token; refreshed rows clear it in favor of owner-bound grants. */
    importToken: schema.string().optional(),
  },
  indexes: [
    { key: { barcode: 1 }, unique: true },
    { key: { expiresAt: 1 } },
  ],
});

export const dbFoodImportGrants = new Store('foodImportGrants', {
  schema: {
    importToken: schema.string(),
    ownerId: schema.userId(),
    barcode: schema.string(),
    expiresAt: schema.date(),
    createdAt: schema.date(),
    usedAt: schema.date().optional(),
  },
  indexes: [
    { key: { importToken: 1 }, unique: true },
    { key: { ownerId: 1, barcode: 1 } },
    { key: { expiresAt: 1 } },
  ],
});
