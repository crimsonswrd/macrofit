import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/client/components/ui/Button';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import { Select } from '@/client/components/ui/Select';
import type { FoodRecord, PersonalFoodInput } from '@/client/lib/foods';

const DEFAULT_VALUES: PersonalFoodInput = {
  name: '',
  category: 'Другое',
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  unit: 'г',
};

export function FoodForm({
  initialFood,
  initialBarcode,
  submitLabel = 'Сохранить продукт',
  isPending = false,
  onSubmit,
}: {
  initialFood?: FoodRecord | null;
  initialBarcode?: string;
  submitLabel?: string;
  isPending?: boolean;
  onSubmit: (input: PersonalFoodInput) => void;
}) {
  const [values, setValues] = useState<PersonalFoodInput>(DEFAULT_VALUES);

  useEffect(() => {
    setValues(
      initialFood
        ? {
            name: initialFood.name,
            brand: initialFood.brand,
            category: initialFood.category,
            calories: initialFood.calories,
            protein: initialFood.protein,
            carbs: initialFood.carbs,
            fat: initialFood.fat,
            unit: initialFood.unit === 'мл' ? 'мл' : 'г',
            barcode: initialFood.barcode,
          }
        : { ...DEFAULT_VALUES, barcode: initialBarcode }
    );
  }, [initialFood, initialBarcode]);

  function set<K extends keyof PersonalFoodInput>(key: K, value: PersonalFoodInput[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      ...values,
      name: values.name.trim(),
      brand: values.brand?.trim() || undefined,
      category: values.category.trim(),
      barcode: values.barcode?.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Название" htmlFor="food-name" className="sm:col-span-2">
          <Input id="food-name" required value={values.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Бренд (необязательно)" htmlFor="food-brand">
          <Input id="food-brand" value={values.brand ?? ''} onChange={(e) => set('brand', e.target.value)} />
        </Field>
        <Field label="Категория" htmlFor="food-category">
          <Input id="food-category" required value={values.category} onChange={(e) => set('category', e.target.value)} />
        </Field>
        <Field label="Штрихкод (необязательно)" htmlFor="food-barcode" className="sm:col-span-2">
          <Input
            id="food-barcode"
            inputMode="numeric"
            pattern="[0-9]*"
            value={values.barcode ?? ''}
            onChange={(e) => set('barcode', e.target.value.replace(/\D/g, ''))}
          />
        </Field>
      </div>

      <div>
        <p className="font-display text-sm font-semibold uppercase tracking-wider text-ink-2">На 100 г / мл</p>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(['calories', 'protein', 'carbs', 'fat'] as const).map((key) => (
            <Field
              key={key}
              label={{ calories: 'Ккал', protein: 'Белки', carbs: 'Углеводы', fat: 'Жиры' }[key]}
              htmlFor={`food-${key}`}
            >
              <Input
                id={`food-${key}`}
                type="number"
                inputMode="decimal"
                required
                min={0}
                step="0.1"
                value={values[key]}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </Field>
          ))}
          <div role="group" aria-labelledby="food-unit-label">
            <Label id="food-unit-label" className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-3">Единица</Label>
            <Select
              value={values.unit}
              onValueChange={(value) => set('unit', value as 'г' | 'мл')}
              options={[{ label: 'г', value: 'г' }, { label: 'мл', value: 'мл' }]}
              className="border-mist-2 bg-paper text-ink focus-visible:ring-flame-500"
            />
          </div>
        </div>
      </div>

      <Button type="submit" color="primary" size="lg" loading={isPending} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-3">
        {label}
      </Label>
      {children}
    </div>
  );
}
