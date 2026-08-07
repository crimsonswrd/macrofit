import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { modelenceMutation } from '@modelence/react-query';
import { Camera, Keyboard, ScanBarcode, TriangleAlert } from 'lucide-react';
import { OpenFoodFactsAttribution } from '@/client/components/foods/OpenFoodFactsAttribution';
import { Button } from '@/client/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/client/components/ui/Dialog';
import { Input } from '@/client/components/ui/Input';
import { fmt } from '@/client/lib/nutrition';
import { formatFoodMeta, isOpenFoodFacts, type BarcodeLookup } from '@/client/lib/foods';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function getBarcodeDetector() {
  return (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

export function BarcodeLookupDialog({
  open,
  onOpenChange,
  onConfirm,
  onManual,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: BarcodeLookup) => void;
  onManual: (barcode: string) => void;
}) {
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState<BarcodeLookup | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const cameraSupported = typeof window !== 'undefined' && Boolean(getBarcodeDetector()) && Boolean(navigator.mediaDevices?.getUserMedia);

  const lookup = useMutation({
    ...modelenceMutation<BarcodeLookup>('foods.lookupBarcode'),
    onSuccess: (data) => {
      setResult(data);
      setBarcode(data.normalizedBarcode);
    },
  });

  useEffect(() => {
    if (!open) {
      setBarcode('');
      setResult(null);
      setCameraOpen(false);
      setBarcodeError('');
      lookup.reset();
    }
  }, [open]);

  function submitBarcode(value = barcode) {
    const normalized = value.replace(/\D/g, '');
    if (normalized.length < 8) {
      setBarcodeError('Введите штрихкод длиной от 8 цифр');
      return;
    }
    setBarcodeError('');
    setCameraOpen(false);
    lookup.mutate({ barcode: normalized });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <div>
          <DialogTitle className="font-display text-2xl font-bold uppercase">Найти по штрихкоду</DialogTitle>
          <DialogDescription className="mt-1 text-ink-3">
            Наведите камеру на код или введите цифры вручную.
          </DialogDescription>
        </div>

        {cameraOpen ? (
          <CameraScanner
            onDetected={(value) => {
              setBarcode(value);
              submitBarcode(value);
            }}
            onCancel={() => setCameraOpen(false)}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <label htmlFor="barcode-lookup" className="sr-only">Штрихкод продукта</label>
              <Input
                id="barcode-lookup"
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Например, 4601234567890"
                value={barcode}
                onChange={(event) => {
                  setBarcode(event.target.value.replace(/\D/g, ''));
                  setResult(null);
                  setBarcodeError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitBarcode();
                }}
                className="tabnum h-11"
                aria-invalid={Boolean(barcodeError)}
                aria-describedby={barcodeError ? 'barcode-lookup-error' : undefined}
              />
              <Button color="primary" loading={lookup.isPending} onClick={() => submitBarcode()}>
                Найти
              </Button>
            </div>
            {barcodeError && <p id="barcode-lookup-error" role="alert" className="text-sm text-flame-500">{barcodeError}</p>}
            {lookup.isError && <p role="alert" className="rounded-lg border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-ink-2">{(lookup.error as Error).message || 'Не удалось выполнить поиск. Повторите попытку.'}</p>}
            {cameraSupported ? (
              <Button variant="outline" className="w-full" leftIcon={<Camera className="size-4" />} onClick={() => setCameraOpen(true)}>
                Сканировать камерой
              </Button>
            ) : (
              <div className="flex gap-2 rounded-xl border border-mist-2 bg-mist p-3 text-sm text-ink-3">
                <Keyboard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p>Сканирование камерой не поддерживается этим браузером. Введите цифры штрихкода вручную.</p>
              </div>
            )}
          </div>
        )}

        {result && <LookupResult result={result} onConfirm={onConfirm} onManual={onManual} />}
      </DialogContent>
    </Dialog>
  );
}

function CameraScanner({ onDetected, onCancel }: { onDetected: (barcode: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let stream: MediaStream | undefined;
    let frame = 0;
    const Detector = getBarcodeDetector();

    async function start() {
      if (!Detector || !videoRef.current) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        const scan = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              active = false;
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {
            // Individual frames can fail while the camera is focusing.
          }
          frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch {
        setError('Не удалось открыть камеру. Проверьте разрешение или введите код вручную.');
      }
    }

    void start();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-xl border border-mist-2 bg-black">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" aria-label="Изображение с камеры" />
        <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-flame-500 shadow-[0_0_0_999px_rgba(0,0,0,.35)]" />
      </div>
      {error && <p role="alert" className="text-sm text-flame-500">{error}</p>}
      <Button variant="outline" className="w-full" onClick={onCancel}>Ввести вручную</Button>
    </div>
  );
}

function LookupResult({
  result,
  onConfirm,
  onManual,
}: {
  result: BarcodeLookup;
  onConfirm: (result: BarcodeLookup) => void;
  onManual: (barcode: string) => void;
}) {
  if (result.status === 'not_found' || !result.food) {
    const incomplete = result.status === 'incomplete';
    return (
      <div className="rounded-xl border border-mist-2 bg-mist p-4">
        <div className="flex gap-3">
          <ScanBarcode className="size-5 shrink-0 text-ink-3" />
          <div>
            <p className="font-bold text-ink">{incomplete ? 'Недостаточно данных' : 'Продукт не найден'}</p>
            <p className="mt-1 text-sm text-ink-3">
              {incomplete
                ? 'Не удалось получить полные КБЖУ. Внесите значения с упаковки вручную.'
                : 'Создайте личный продукт — штрихкод уже будет заполнен.'}
            </p>
            {result.warnings.length > 0 && <p className="mt-2 text-xs text-carb">{result.warnings.join(' · ')}</p>}
          </div>
        </div>
        <Button color="primary" className="mt-4 w-full" onClick={() => onManual(result.normalizedBarcode)}>
          Заполнить вручную
        </Button>
      </div>
    );
  }

  const { food } = result;
  const warnings = [...(result.warnings ?? []), ...(food.dataQualityWarnings ?? [])];
  return (
    <div className="rounded-xl border border-mist-2 bg-mist p-4">
      <p className="font-display text-xl font-bold uppercase text-ink">{food.name}</p>
      <p className="mt-1 text-sm text-ink-3">{formatFoodMeta(food)}</p>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        {[
          ['Ккал', food.calories],
          ['Белки', food.protein],
          ['Углев.', food.carbs],
          ['Жиры', food.fat],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-paper p-2">
            <p className="tabnum font-display text-lg font-bold">{fmt(Number(value), 1)}</p>
            <p className="text-[10px] uppercase text-ink-3">{label}</p>
          </div>
        ))}
      </div>
      {(result.status === 'incomplete' || warnings.length > 0) && (
        <div className="mt-4 flex gap-2 rounded-lg border border-carb/30 bg-carb/10 p-3 text-sm text-ink-2">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-carb" />
          <div>
            <p className="font-bold">Проверьте данные перед сохранением</p>
            {warnings.length > 0 && <p className="mt-1 text-xs text-ink-3">{warnings.join(' · ')}</p>}
          </div>
        </div>
      )}
      {isOpenFoodFacts(food) && <OpenFoodFactsAttribution className="mt-4" />}
      <DialogFooter className="mt-5">
        <Button variant="outline" onClick={() => onManual(result.normalizedBarcode)}>Заполнить вручную</Button>
        <Button color="primary" onClick={() => onConfirm(result)}>
          {food.source === 'open-food-facts' ? 'Проверил, сохранить' : 'Использовать продукт'}
        </Button>
      </DialogFooter>
    </div>
  );
}
