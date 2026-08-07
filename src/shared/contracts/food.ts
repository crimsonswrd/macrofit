export const FOOD_SOURCES = ['catalog', 'personal', 'open-food-facts'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

export const FOOD_UNITS = ['г', 'мл'] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const BARCODE_LOOKUP_STATUSES = ['found', 'not_found', 'incomplete'] as const;
export type BarcodeLookupStatus = (typeof BARCODE_LOOKUP_STATUSES)[number];

export type Food = {
  id: string;
  source: FoodSource;
  name: string;
  brand?: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit: FoodUnit;
  barcode?: string;
  isVerified: boolean;
  dataSource?: string;
  dataQualityWarnings?: string[];
};

export type BarcodeLookupResult = {
  status: BarcodeLookupStatus;
  food?: Food;
  normalizedBarcode: string;
  source?: FoodSource;
  warnings: string[];
  /** Opaque proof that this result came from a confirmed OFF lookup. */
  importToken?: string;
};
