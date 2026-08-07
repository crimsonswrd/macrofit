# Design — FORMETRA

## Source of truth
- Status: Active
- Last refreshed: 2026-08-06
- Primary product surfaces: дневник питания, совет «Что съесть сейчас», прогресс веса, профиль и настройки, PWA на телефоне.
- Evidence reviewed: `src/client/pages/*`, `src/client/components/*`, `src/client/index.css`, текущие мобильная навигация и состояния загрузки/ошибок.

## Brand
- Personality: спокойный спортивный навигатор — точный, собранный, поддерживающий и понятный новичку.
- Trust signals: объясняет происхождение расчётов, не меняет нормы без подтверждения, показывает ограничения рекомендаций.
- Avoid: медицинские обещания, стыд за отклонения, агрессивные «срывы», перегруженные фитнес-панели и слепые AI-решения.

## Product goals
- Goals: помогать быстро фиксировать питание, понимать следующий полезный шаг, видеть устойчивый тренд и управлять персональной нормой.
- Non-goals: лечение, диагностика, автоматическое изменение норм, полноценный трекер тренировок.
- Success signals: запись еды за несколько касаний, понятный совет без ручного анализа БЖУ, регулярное возвращение без тревоги и установка на домашний экран.

## Personas and jobs
- Primary personas: начинающий пользователь, человек на снижении/наборе веса, спортсмен с потребностью в полном контроле БЖУ.
- User jobs: понять сколько есть, быстро записать факт, выбрать подходящую еду сейчас, оценить направление прогресса.
- Key contexts of use: телефон на кухне/в магазине/зале, короткие проверки в течение дня, вечерний разбор.

## Information architecture
- Primary navigation: Дневник, Продукты, Прогресс, Профиль; личные продукты остаются внутри раздела продуктов на мобильном.
- Core routes/screens: `/`, `/foods`, `/foods/mine`, `/progress`, `/profile`, `/onboarding`.
- Content hierarchy: сегодняшний ориентир → одно следующее действие → дневник → детальные данные.

## Design principles
- Progressive disclosure: режим «Просто» оставляет калории, белок и действия; режим «Спорт» раскрывает полные БЖУ и детали.
- Consent before change: еда и новые нормы добавляются/применяются только после явного подтверждения.
- Rhythm over perfection: диапазоны, недельный тренд и нейтральные формулировки важнее серии идеальных дней.
- One clear action: каждая подсказка предлагает не более одного следующего шага.
- Tradeoffs: рекомендации по еде намеренно используют понятные продуктовые сочетания вместо медицинской персонализации и сложного генеративного меню.

## Visual language
- Color: `mist #0d0f0e` фон, `paper #171918` поверхность, `ink #f4f1e8` текст, `flame #ff5a4f` действие, `steady #b8f26a` спокойный прогресс; белки/углеводы/жиры имеют отдельные акценты.
- Typography: Oswald для крупных чисел и заголовков, Manrope для текста и элементов управления.
- Spacing/layout rhythm: базовый шаг 4px; мобильные поля 16px, desktop 24px; карточки группируются блоками по 16–20px.
- Shape/radius/elevation: контролы 12px, карточки 22px, крупные промо-блоки 28px; тени тихие, разделение в основном поверхностями и границами.
- Motion: короткие fade/slide/pop/bar; функциональная анимация без бесконечного движения.
- Imagery/iconography: Lucide для действий; фирменный знак — буква F с линией прогресса, без декоративных иллюстраций.

## Components
- Existing components to reuse: `Page`, `Button`, `IconButton`, `Dialog`, `Select`, `Switch`, `Input`, карточки дневника и график тренда.
- New/changed components: `InterfaceModeToggle`, `WhatToEatCard`, `DailyRhythmCard`, `SmartReminderCard`, `ProductSettings`, `PwaInstallCard`.
- Variants and states: простой/спортивный режим; подсказка/почти выполнено/выше ориентира; install available/iOS instructions/already installed.
- Token/component ownership: палитра и motion в `src/client/index.css`; продуктовые предпочтения в `src/client/lib/preferences.ts`.

## Accessibility
- Target standard: WCAG 2.2 AA для основных сценариев.
- Keyboard/focus behavior: видимое кольцо, диалоги с фокус-ловушкой, все действия доступны с клавиатуры.
- Contrast/readability: тёплый светлый текст на угольных поверхностях; цвет не является единственным носителем смысла.
- Screen-reader semantics: landmark-навигация, заголовки секций, `aria-live` для меняющихся статусов, понятные названия кнопок.
- Reduced motion and sensory considerations: `prefers-reduced-motion` отключает длительные переходы; нет мигающих или тревожных состояний.

## Responsive behavior
- Supported breakpoints/devices: 320px+; современные Safari iOS, Chrome Android и desktop-браузеры.
- Layout adaptations: нижняя навигация на телефоне, сетки превращаются в одну колонку, диалоги ограничены высотой экрана.
- Touch/hover differences: минимум 44px для touch; hover-эффекты не скрывают обязательные действия.

## Interaction states
- Loading: сохранять предыдущие данные и показывать локальный индикатор.
- Empty: объяснять первый полезный шаг, не показывать «нулевой провал».
- Error: сохранять доступные данные и предлагать точечный повтор.
- Success: короткое подтверждение без конфетти и давления.
- Disabled: объяснимое состояние во время сохранения/недоступности.
- Offline/slow network: PWA открывает оболочку и объясняет, что дневнику нужно соединение для синхронизации.

## Content voice
- Tone: спокойный, конкретный, уважительный, на «вы».
- Terminology: «ориентир», «ритм», «осталось», «предложение»; избегать «провал», «срыв», «плохой день», «наказание».
- Microcopy rules: одна мысль в предложении; цифры сопровождаются смыслом; любое автоматическое предложение можно отклонить.

## Implementation constraints
- Framework/styling system: React 19, React Router, Modelence, Tailwind CSS-first.
- Design-token constraints: сохранять существующие `mist/paper/ink/flame` и расширять их без нового слоя дизайн-системы.
- Performance constraints: новые рекомендации рассчитываются локально по уже доступной базе; без тяжёлых AI-зависимостей.
- Compatibility constraints: PWA-установка требует HTTPS либо localhost; системные напоминания требуют разрешения браузера.
- Test/screenshot expectations: unit-тесты чистой логики, typecheck, полный test suite и production build.

## Open questions
- [ ] Для полностью фоновых push-напоминаний позже понадобится сервер подписок и публичный HTTPS-домен.
- [ ] Перед публичным релизом проверить товарный знак FORMETRA и доступность домена.
