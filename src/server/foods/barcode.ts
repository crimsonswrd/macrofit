export type BarcodeKind = 'ean-8' | 'upc-a' | 'ean-13';

export type NormalizedBarcode = {
  value: string;
  kind: BarcodeKind;
};

/** Calculates the GS1 check digit for all digits preceding the check digit. */
export function calculateBarcodeCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) throw new Error('Barcode body must contain only digits');

  let sum = 0;
  for (let index = body.length - 1, position = 0; index >= 0; index -= 1, position += 1) {
    const digit = Number(body[index]);
    sum += digit * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** Accepts EAN-8, UPC-A, and EAN-13; UPC-A is stored canonically as EAN-13. */
export function normalizeBarcode(input: string): NormalizedBarcode | null {
  const compact = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(compact) || ![8, 12, 13].includes(compact.length)) return null;

  const body = compact.slice(0, -1);
  if (calculateBarcodeCheckDigit(body) !== Number(compact.at(-1))) return null;

  if (compact.length === 8) return { value: compact, kind: 'ean-8' };
  if (compact.length === 12) return { value: `0${compact}`, kind: 'upc-a' };
  return { value: compact, kind: 'ean-13' };
}
