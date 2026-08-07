import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createQueryKey, modelenceMutation, modelenceQuery } from '@modelence/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Page from '@/client/components/Page';
import { ChoiceGrid, QuestionSection } from '@/client/components/onboarding/QuestionSection';
import { TargetPreviewCard } from '@/client/components/onboarding/TargetPreviewCard';
import { Button } from '@/client/components/ui/Button';
import { Checkbox } from '@/client/components/ui/Checkbox';
import { Input } from '@/client/components/ui/Input';
import { Label } from '@/client/components/ui/Label';
import {
  type EerSexClass,
  type GoalMode,
  type JobActivity,
  type LifeStage,
  type ProfileDraft,
  type TargetPreview,
  type TrainingType,
  type UserProfile,
  browserTimeZone,
  parseNumberFieldDraft,
} from '@/client/lib/profile';

const INITIAL_PROFILE: ProfileDraft = {
  birthDate: '',
  eerSexClass: 'male',
  heightCm: 175,
  currentWeightKg: 75,
  goalMode: 'maintain',
  jobActivity: 'sedentary',
  stepsPerDay: 6000,
  trainingSessionsPerWeek: 3,
  trainingType: 'strength',
  lifeStage: 'general',
  requiresSpecializedGuidance: false,
  acknowledgedEstimate: false,
};

function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function unsupportedReasons(profile: ProfileDraft): string[] {
  const reasons: string[] = [];
  const age = ageFromBirthDate(profile.birthDate);
  if (age !== null && age < 18) reasons.push('Сервис доступен только совершеннолетним пользователям.');
  if (profile.lifeStage !== 'general') reasons.push('Беременность и грудное вскармливание требуют персональных рекомендаций специалиста.');
  if (profile.requiresSpecializedGuidance) reasons.push('При заболеваниях, восстановлении или лечебной диете расчёт должен вести специалист.');
  return reasons;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileDraft>(INITIAL_PROFILE);
  const [preview, setPreview] = useState<TargetPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [loadedExisting, setLoadedExisting] = useState(false);
  const [formError, setFormError] = useState('');

  const currentProfileQuery = useQuery({
    ...modelenceQuery<UserProfile | null>('profile.getCurrent', {}),
    retry: false,
  });

  useEffect(() => {
    if (!loadedExisting && currentProfileQuery.data !== undefined) {
      if (currentProfileQuery.data) {
        const { revision: _revision, updatedAt: _updatedAt, timeZone: _timeZone, ...draft } = currentProfileQuery.data;
        setProfile(draft);
      }
      setLoadedExisting(true);
    }
  }, [currentProfileQuery.data, loadedExisting]);

  const saveMutation = useMutation({
    ...modelenceMutation<UserProfile>('profile.saveProfile'),
    onSuccess: async () => {
      setIsPreviewing(true);
      try {
        const result = await queryClient.fetchQuery({
          ...modelenceQuery<TargetPreview>('targets.preview', {}),
          staleTime: 0,
        });
        setPreview(result);
      } catch (error) {
        setFormError((error as Error).message || 'Не удалось рассчитать цели');
      } finally {
        setIsPreviewing(false);
      }
    },
    onError: (error) => setFormError((error as Error).message || 'Не удалось сохранить анкету'),
  });

  const confirmMutation = useMutation({
    ...modelenceMutation('targets.confirmPreview'),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: createQueryKey('profile.getCurrent', {}) }),
        queryClient.invalidateQueries({ queryKey: createQueryKey('profile.getOnboardingState', {}) }),
        queryClient.invalidateQueries({ queryKey: createQueryKey('targets.listHistory', {}) }),
      ]);
      toast.success('Цели сохранены');
      navigate('/profile', { replace: true });
    },
    onError: (error) => toast.error((error as Error).message || 'Не удалось подтвердить цели'),
  });

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reasons = unsupportedReasons(profile);
    if (reasons.length > 0) {
      setPreview({
        eligible: false,
        reasons,
        profileRevision: 0,
      });
      return;
    }
    if (!profile.acknowledgedEstimate) {
      setFormError('Подтвердите, что понимаете приблизительный характер расчёта');
      return;
    }
    setFormError('');
    saveMutation.mutate({ ...profile, timeZone: browserTimeZone() });
  };

  if (currentProfileQuery.isError) {
    return (
      <Page seo={{ title: 'Настройка личных целей', noindex: true }}>
        <div role="alert" className="mx-auto max-w-xl rounded-2xl border border-flame-500/30 bg-paper p-6 text-center">
          <h1 className="font-display text-2xl font-bold uppercase">Не удалось загрузить анкету</h1>
          <p className="mt-2 text-sm text-ink-3">Ваши сохранённые ответы не будут заменены начальными значениями.</p>
          <Button className="mt-5" color="primary" onClick={() => currentProfileQuery.refetch()}>Повторить</Button>
        </div>
      </Page>
    );
  }

  if (currentProfileQuery.isLoading || !loadedExisting) {
    return <Page seo={{ title: 'Настройка личных целей', noindex: true }}><div className="py-24 text-center text-sm text-ink-3">Загружаем анкету…</div></Page>;
  }

  if (preview) {
    return (
      <Page seo={{ title: preview.eligible ? 'Предварительный расчёт' : 'Расчёт недоступен', noindex: true }}>
        <div className="mx-auto max-w-3xl">
          <TargetPreviewCard
            preview={preview}
            isConfirming={confirmMutation.isPending}
            onEdit={() => setPreview(null)}
            onConfirm={() => preview.eligible && confirmMutation.mutate({ profileRevision: preview.profileRevision })}
          />
        </div>
      </Page>
    );
  }

  return (
    <Page seo={{ title: 'Настройка личных целей', noindex: true }} className="pb-12">
      <div className="mx-auto max-w-3xl">
        <header className="animate-slide-down">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-flame-500">Личные цели</p>
          <h1 className="mt-2 font-display text-4xl font-bold uppercase leading-none tracking-tight sm:text-5xl">Расскажите о себе</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
            Ответы нужны, чтобы оценить расход энергии и КБЖУ. Перед сохранением вы увидите все числа и факторы расчёта.
          </p>
        </header>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <QuestionSection number={1} title="Допустимость расчёта" description="Автоматический расчёт предназначен для здоровых взрослых от 18 лет.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="birth-date" className="mb-1.5 text-sm font-semibold">Дата рождения</Label>
                <Input id="birth-date" type="date" required value={profile.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => update('birthDate', event.target.value)} />
              </div>
              <div>
                <ChoiceGrid<LifeStage>
                  name="lifeStage"
                  legend="Жизненный этап"
                  value={profile.lifeStage}
                  onChange={(value) => update('lifeStage', value)}
                  options={[
                    { value: 'general', label: 'Обычный период' },
                    { value: 'pregnant', label: 'Беременность' },
                    { value: 'breastfeeding', label: 'Грудное вскармливание' },
                  ]}
                  columns={3}
                />
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-mist-2 bg-mist/50 p-3">
              <Checkbox checked={profile.requiresSpecializedGuidance} onCheckedChange={(value) => update('requiresSpecializedGuidance', Boolean(value))} />
              <span className="text-sm leading-relaxed text-ink-2">У меня есть заболевание, лечебная диета, восстановление после операции или другое состояние, требующее рекомендаций специалиста.</span>
            </label>
          </QuestionSection>

          <QuestionSection number={2} title="Параметры тела" description="Класс пола используется только как коэффициент утверждённой энергетической формулы. Он не описывает гендерную идентичность.">
            <ChoiceGrid<EerSexClass>
              name="eerSexClass"
              legend="Класс формулы"
              value={profile.eerSexClass}
              onChange={(value) => update('eerSexClass', value)}
              options={[
                { value: 'male', label: 'Мужской класс формулы', hint: 'Выберите, если физиологические коэффициенты мужской формулы подходят вам.' },
                { value: 'female', label: 'Женский класс формулы', hint: 'Выберите, если физиологические коэффициенты женской формулы подходят вам.' },
              ]}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField label="Рост, см" value={profile.heightCm} min={120} max={230} onChange={(value) => update('heightCm', value)} />
              <NumberField label="Текущий вес, кг" value={profile.currentWeightKg} min={35} max={350} step={0.1} onChange={(value) => update('currentWeightKg', value)} />
              <NumberField
                label="Желаемый вес, кг"
                value={profile.goalWeightKg ?? ''}
                min={35}
                max={350}
                step={0.1}
                required={profile.goalMode === 'loss' || profile.goalMode === 'gain' || profile.goalMode === 'muscle'}
                onChange={(value) => update('goalWeightKg', value)}
                onClear={() => update('goalWeightKg', undefined)}
              />
            </div>
          </QuestionSection>

          <QuestionSection number={3} title="Цель">
            <ChoiceGrid<GoalMode>
              name="goalMode"
              legend="Основная цель"
              value={profile.goalMode}
              onChange={(value) => update('goalMode', value)}
              options={[
                { value: 'maintain', label: 'Поддерживать вес' },
                { value: 'loss', label: 'Снизить вес' },
                { value: 'gain', label: 'Набрать вес' },
                { value: 'muscle', label: 'Набрать мышцы' },
                { value: 'strength', label: 'Повысить силу' },
              ]}
              columns={3}
            />
          </QuestionSection>

          <QuestionSection number={4} title="Активность вне тренировок">
            <ChoiceGrid<JobActivity>
              name="jobActivity"
              legend="Нагрузка в течение дня"
              value={profile.jobActivity}
              onChange={(value) => update('jobActivity', value)}
              options={[
                { value: 'sedentary', label: 'Сидячая работа', hint: 'Большую часть дня сижу' },
                { value: 'light', label: 'Лёгкая нагрузка', hint: 'Регулярно хожу или стою' },
                { value: 'moderate', label: 'Подвижная работа', hint: 'Много движения в течение дня' },
                { value: 'heavy', label: 'Тяжёлая работа', hint: 'Регулярный физический труд' },
              ]}
            />
            <div className="mt-4 max-w-xs">
              <NumberField label="Среднее число шагов в день" value={profile.stepsPerDay} min={0} max={50000} step={500} onChange={(value) => update('stepsPerDay', value)} />
            </div>
          </QuestionSection>

          <QuestionSection number={5} title="Тренировки">
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <NumberField
                label="Тренировок в неделю"
                value={profile.trainingSessionsPerWeek}
                min={0}
                max={14}
                onChange={(value) => setProfile((current) => {
                  let trainingType = current.trainingType;
                  if (value === 0) {
                    trainingType = 'none';
                  } else if (trainingType === 'none') {
                    trainingType = 'mixed';
                  }
                  return { ...current, trainingSessionsPerWeek: value, trainingType };
                })}
              />
              <div>
                <ChoiceGrid<TrainingType>
                  name="trainingType"
                  legend="Основной тип"
                  value={profile.trainingType}
                  onChange={(value) => setProfile((current) => ({ ...current, trainingType: value, trainingSessionsPerWeek: value === 'none' ? 0 : Math.max(1, current.trainingSessionsPerWeek) }))}
                  options={[
                    { value: 'none', label: 'Нет тренировок' },
                    { value: 'strength', label: 'Силовые' },
                    { value: 'cardio', label: 'Кардио' },
                    { value: 'mixed', label: 'Смешанные' },
                  ]}
                />
              </div>
            </div>
          </QuestionSection>

          <div className="rounded-2xl border border-mist-2 bg-paper p-5 sm:p-6">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={profile.acknowledgedEstimate}
                aria-invalid={Boolean(formError) && !profile.acknowledgedEstimate}
                aria-describedby={formError ? 'onboarding-form-error' : undefined}
                onCheckedChange={(value) => { update('acknowledgedEstimate', Boolean(value)); setFormError(''); }}
              />
              <span className="text-sm leading-relaxed text-ink-2">Я понимаю, что результат будет приблизительной отправной точкой. Он не заменяет медицинскую рекомендацию, а изменения целей не применяются без моего подтверждения.</span>
            </label>
            {formError && <p id="onboarding-form-error" role="alert" className="mt-4 rounded-lg border border-flame-500/30 bg-flame-500/10 p-3 text-sm text-ink-2">{formError}</p>}
            <div className="mt-5 flex flex-col items-start justify-between gap-4 border-t border-mist-2 pt-5 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-xs text-ink-3"><ShieldCheck className="size-4 text-flame-500" /> Расчёт появится до сохранения целей</p>
              <Button type="submit" color="primary" size="lg" loading={saveMutation.isPending || isPreviewing} rightIcon={<ArrowRight className="size-4" />}>Показать расчёт</Button>
            </div>
          </div>
        </form>
      </div>
    </Page>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | '';
  min: number;
  max: number;
  step?: number;
  required?: boolean;
  onChange: (value: number) => void;
  onClear?: () => void;
}

function NumberField({ label, value, min, max, step = 1, required = true, onChange, onClear }: NumberFieldProps) {
  const id = label.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-');
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 text-sm font-semibold">{label}</Label>
      <Input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        required={required}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const parsed = parseNumberFieldDraft(nextDraft);
          if (parsed === undefined) {
            if (nextDraft === '') onClear?.();
            return;
          }
          onChange(parsed);
        }}
      />
    </div>
  );
}
