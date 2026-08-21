import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createQueryKey, modelenceMutation, modelenceQuery } from '@modelence/react-query';
import { Archive, Pencil, Plus, ScanBarcode, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { BarcodeLookupDialog } from '@/client/components/foods/BarcodeLookupDialog';
import { FoodForm } from '@/client/components/foods/FoodForm';
import { FoodSourceBadge } from '@/client/components/foods/FoodStatusBadge';
import { Button } from '@/client/components/ui/Button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/client/components/ui/Dialog';
import { fmt } from '@/client/lib/nutrition';
import {
  formatFoodMeta,
  personalFoodInputFromLookup,
  type FoodRecord,
  type PersonalFoodInput,
} from '@/client/lib/foods';

export default function PersonalFoodsPage() {
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [barcodeOpen, setBarcodeOpen] = useState(false);
  const [editing, setEditing] = useState<FoodRecord | null>(null);
  const [prefilled, setPrefilled] = useState<FoodRecord | null>(null);
  const [initialBarcode, setInitialBarcode] = useState<string>();
  const [createdFoodId, setCreatedFoodId] = useState<string>();
  const [archiving, setArchiving] = useState<FoodRecord | null>(null);

  const mineQuery = useQuery({
    ...modelenceQuery<FoodRecord[]>('foods.searchPersonal', { query: '', limit: 100 }),
    staleTime: 30_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['foods.searchPersonal'] });
    queryClient.invalidateQueries({ queryKey: ['nutrition.searchFoods'] });
  };

  const createFood = useMutation({
    ...modelenceMutation('foods.createPersonal'),
    onSuccess: (result) => {
      const id = typeof result === 'string' ? result : (result as { id?: string })?.id;
      setCreatedFoodId(id);
      setEditorOpen(false);
      setBarcodeOpen(false);
      refresh();
      toast.success('Личный продукт сохранён');
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const updateFood = useMutation({
    ...modelenceMutation('foods.updatePersonal'),
    onSuccess: () => {
      setArchiving(null);
      setEditorOpen(false);
      setEditing(null);
      refresh();
      toast.success('Продукт обновлён');
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const archiveFood = useMutation({
    ...modelenceMutation('foods.archivePersonal'),
    onSuccess: () => {
      refresh();
      toast.success('Продукт перемещён в архив');
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const submitFood = useMutation({
    ...modelenceMutation('foods.submitPersonal'),
    onSuccess: () => {
      setCreatedFoodId(undefined);
      queryClient.invalidateQueries({ queryKey: createQueryKey('foods.getMySubmissions', {}) });
      toast.success('Отправлено на модерацию');
    },
    onError: (error) => toast.error((error as Error).message),
  });

  function openCreate(barcode?: string, food?: FoodRecord) {
    setEditing(null);
    setPrefilled(food ?? null);
    setInitialBarcode(barcode);
    setEditorOpen(true);
  }

  function handleSave(input: PersonalFoodInput) {
    if (editing) updateFood.mutate({ id: editing.id, food: input });
    else createFood.mutate(input);
  }

  return (
    <Page seo={{ title: 'Мои продукты' }} className="pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none">Мои продукты</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-3">
            Добавляйте продукты со своей упаковки. Они видны только вам, пока вы сами не отправите их в общий каталог.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" leftIcon={<ScanBarcode className="size-4" />} onClick={() => setBarcodeOpen(true)}>
            Штрихкод
          </Button>
          <Button color="primary" leftIcon={<Plus className="size-4" />} onClick={() => openCreate()}>
            Создать
          </Button>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto border-b border-mist-2 pb-2 text-sm font-semibold">
        <Link to="/foods" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Общий каталог</Link>
        <span className="flex min-h-11 shrink-0 items-center px-2 text-flame-500">Мои продукты</span>
        <Link to="/foods/submissions" className="flex min-h-11 shrink-0 items-center px-2 text-ink-3 hover:text-ink">Мои заявки</Link>
      </div>

      {createdFoodId && (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <p className="font-bold text-ink">Продукт готов</p>
          <p className="mt-1 text-sm text-ink-3">Его уже можно найти при добавлении еды в дневник.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button render={<Link to="/" />} color="primary">Перейти в дневник</Button>
            <Button
              variant="outline"
              leftIcon={<Send className="size-4" />}
              loading={submitFood.isPending}
              onClick={() => submitFood.mutate({ personalFoodId: createdFoodId })}
            >
              Предложить в общий каталог
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6">
        {mineQuery.isLoading ? (
          <p className="py-10 text-center text-sm text-ink-3">Загружаем продукты…</p>
        ) : mineQuery.isError ? (
          <div role="alert" className="rounded-xl border border-flame-500/30 bg-flame-500/10 p-4 text-sm text-ink-2">
            <p>Не удалось загрузить личные продукты.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => mineQuery.refetch()}>Повторить</Button>
          </div>
        ) : mineQuery.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {mineQuery.data.map((food) => (
              <li key={food.id} className="rounded-2xl border border-mist-2 bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="min-w-0 truncate font-bold text-ink">{food.name}</h2>
                      <FoodSourceBadge source="personal" />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-3">{formatFoodMeta(food)}</p>
                  </div>
                  <p className="tabnum shrink-0 font-display text-xl font-bold text-flame-500">{fmt(food.calories)}</p>
                </div>
                <p className="tabnum mt-3 text-xs text-ink-3">
                  Б {fmt(food.protein, 1)} · У {fmt(food.carbs, 1)} · Ж {fmt(food.fat, 1)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-11"
                    variant="outline"
                    leftIcon={<Pencil className="size-3.5" />}
                    onClick={() => {
                      setEditing(food);
                      setPrefilled(null);
                      setEditorOpen(true);
                    }}
                  >
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-11"
                    variant="ghost"
                    leftIcon={<Archive className="size-3.5" />}
                    disabled={archiveFood.isPending}
                    onClick={() => setArchiving(food)}
                  >
                    В архив
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-11"
                    variant="ghost"
                    leftIcon={<Send className="size-3.5" />}
                    disabled={submitFood.isPending}
                    onClick={() => submitFood.mutate({ personalFoodId: food.id })}
                  >
                    Предложить в общий каталог
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-mist-2 bg-paper p-8 text-center">
            <ScanBarcode className="mx-auto size-8 text-ink-3" />
            <p className="mt-3 font-bold text-ink">Пока нет личных продуктов</p>
            <p className="mt-1 text-sm text-ink-3">Отсканируйте упаковку или внесите КБЖУ вручную.</p>
          </div>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <div>
            <DialogTitle className="font-display text-2xl font-bold uppercase">
              {editing ? 'Изменить продукт' : 'Новый личный продукт'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-ink-3">
              Значения указываются на 100 г или 100 мл. Проверьте этикетку перед сохранением.
            </DialogDescription>
          </div>
          <FoodForm
            initialFood={editing ?? prefilled}
            initialBarcode={initialBarcode}
            isPending={createFood.isPending || updateFood.isPending}
            submitLabel={editing ? 'Сохранить изменения' : 'Создать продукт'}
            onSubmit={handleSave}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiving)} onOpenChange={(open) => !archiveFood.isPending && !open && setArchiving(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-display text-2xl font-bold uppercase">Переместить продукт в архив?</DialogTitle>
          <DialogDescription className="text-ink-3">
            {archiving ? `«${archiving.name}» исчезнет из поиска, но записи дневника сохранятся.` : ''}
          </DialogDescription>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={archiveFood.isPending} onClick={() => setArchiving(null)}>Отмена</Button>
            <Button color="destructive" loading={archiveFood.isPending} onClick={() => archiving && archiveFood.mutate({ id: archiving.id })}>В архив</Button>
          </div>
        </DialogContent>
      </Dialog>

      <BarcodeLookupDialog
        open={barcodeOpen}
        onOpenChange={setBarcodeOpen}
        onManual={(barcode) => {
          setBarcodeOpen(false);
          openCreate(barcode);
        }}
        onConfirm={(result) => {
          const food = result.food;
          if (!food) return;
          if (food.source !== 'open-food-facts') {
            setBarcodeOpen(false);
            toast.success('Продукт уже доступен в дневнике');
            return;
          }
          const input = personalFoodInputFromLookup(result);
          if (!input) {
            toast.error('Срок подтверждения данных истёк. Выполните поиск ещё раз.');
            return;
          }
          createFood.mutate(input);
        }}
      />
    </Page>
  );
}
