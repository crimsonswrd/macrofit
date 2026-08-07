import { useEffect, useState } from 'react';
import { BellRing, Download, MonitorSmartphone, Settings2 } from 'lucide-react';
import { Button } from '@/client/components/ui/Button';
import { Input } from '@/client/components/ui/Input';
import { Select } from '@/client/components/ui/Select';
import { Switch } from '@/client/components/ui/Switch';
import { InterfaceModeToggle } from '@/client/components/preferences/InterfaceModeToggle';
import {
  useInterfaceMode,
  useReminderSettings,
  type ReminderSettings,
} from '@/client/lib/preferences';
import {
  isIosDevice,
  isStandalonePwa,
  notificationPermission,
  requestNotificationPermission,
} from '@/client/lib/pwa';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DAYS = [
  { value: '1', label: 'Понедельник' },
  { value: '2', label: 'Вторник' },
  { value: '3', label: 'Среда' },
  { value: '4', label: 'Четверг' },
  { value: '5', label: 'Пятница' },
  { value: '6', label: 'Суббота' },
  { value: '0', label: 'Воскресенье' },
];

export function ProductSettings() {
  return (
    <section className="mt-5" aria-labelledby="formetra-settings-title">
      <div className="flex items-center gap-2">
        <Settings2 className="size-5 text-flame-500" aria-hidden="true" />
        <h2 id="formetra-settings-title" className="font-display text-2xl font-bold uppercase">Как FORMETRA работает для вас</h2>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <InterfaceSettings />
        <ReminderSettingsCard />
        <PwaInstallCard />
      </div>
    </section>
  );
}

function InterfaceSettings() {
  const [mode, setMode] = useInterfaceMode();
  return (
    <div className="rounded-2xl border border-mist-2 bg-paper p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Интерфейс</p>
      <h3 className="mt-1 font-display text-xl font-bold uppercase">Нужная глубина</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">«Простой» оставляет калории, белок и действия. «Спорт» показывает полные БЖУ и детали.</p>
      <div className="mt-4"><InterfaceModeToggle mode={mode} onChange={setMode} /></div>
    </div>
  );
}

function ReminderSettingsCard() {
  const [settings, setSettings] = useReminderSettings();
  const [permission, setPermission] = useState(() => notificationPermission());
  const update = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  async function enableSystemNotifications() {
    const next = await requestNotificationPermission();
    setPermission(next);
    update('browserNotifications', next === 'granted');
  }

  return (
    <div className="rounded-2xl border border-mist-2 bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-steady-500">Напоминания</p>
          <h3 className="mt-1 font-display text-xl font-bold uppercase">Вовремя, не чаще</h3>
        </div>
        <Switch checked={settings.enabled} onCheckedChange={(checked) => update('enabled', checked)} aria-label="Включить умные напоминания" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">Подсказка появляется только когда есть полезное действие, а не по каждому пропущенному числу.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TimeField label="Первая проверка" value={settings.firstCheckTime} onChange={(value) => update('firstCheckTime', value)} disabled={!settings.enabled} />
        <TimeField label="Вечерний итог" value={settings.eveningCheckTime} onChange={(value) => update('eveningCheckTime', value)} disabled={!settings.enabled} />
      </div>
      <div className="mt-3 grid grid-cols-[1fr_100px] gap-3">
        <div>
          <label className="text-xs font-semibold text-ink-3">День взвешивания</label>
          <Select options={DAYS} value={settings.weeklyWeighDay} onValueChange={(value) => update('weeklyWeighDay', value)} disabled={!settings.enabled} className="mt-1" />
        </div>
        <TimeField label="Время" value={settings.weeklyWeighTime} onChange={(value) => update('weeklyWeighTime', value)} disabled={!settings.enabled} />
      </div>
      {permission === 'granted' ? (
        <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-steady-500"><BellRing className="size-4" /> Системные уведомления разрешены</p>
      ) : (
        <Button className="mt-4" size="sm" variant="outline" leftIcon={<BellRing className="size-4" />} onClick={() => void enableSystemNotifications()} disabled={permission === 'denied'}>
          {permission === 'denied' ? 'Уведомления запрещены в браузере' : 'Разрешить уведомления'}
        </Button>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-ink-3">Сейчас системная подсказка срабатывает, пока FORMETRA открыта. Полностью фоновые уведомления появятся после подключения push-сервера.</p>
    </div>
  );
}

function TimeField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3">{label}</label>
      <Input className="mt-1" type="time" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </div>
  );
}

function PwaInstallCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [secure, setSecure] = useState(true);

  useEffect(() => {
    setInstalled(isStandalonePwa());
    setIos(isIosDevice());
    setSecure(window.isSecureContext);
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const complete = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', complete);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="rounded-2xl border border-mist-2 bg-paper p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-flame-500">Телефон</p>
      <h3 className="mt-1 font-display text-xl font-bold uppercase">Как отдельное приложение</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">Иконка на домашнем экране, полноэкранный запуск и быстрая загрузка оболочки.</p>
      {installed ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-steady-50 p-3 text-sm font-semibold text-steady-500">
          <MonitorSmartphone className="size-5" /> FORMETRA уже установлена
        </div>
      ) : prompt ? (
        <Button className="mt-4" color="primary" leftIcon={<Download className="size-4" />} onClick={() => void install()}>Установить FORMETRA</Button>
      ) : ios ? (
        <div className="mt-4 rounded-xl border border-mist-2 bg-mist p-3 text-sm leading-relaxed text-ink-2">В Safari нажмите «Поделиться», затем «На экран Домой».</div>
      ) : (
        <div className="mt-4 rounded-xl border border-mist-2 bg-mist p-3 text-sm leading-relaxed text-ink-2">
          {secure ? 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».' : 'На локальном адресе можно создать ярлык через меню браузера. Полная PWA-установка активируется на HTTPS-адресе.'}
        </div>
      )}
    </div>
  );
}
