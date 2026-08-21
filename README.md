# Macro Fit

Веб-приложение FORMETRA для дневника питания, персональных ориентиров БЖУ и
отслеживания веса. Основа: React, Vite и Modelence.

## Быстрый запуск без Cloud

Требуется Node.js 20+, pnpm 11.9+ и локально установленный MongoDB (`mongod`).

```bash
pnpm install
pnpm db:local
```

В другом окне Terminal:

```bash
pnpm dev
```

Проект настроен на локальную базу `mongodb://127.0.0.1:27017/macro-fit`.
На первом запуске Modelence создаст коллекции, миграции и тестовые данные.
Файл `.modelence.env` остаётся локальным и исключён из Git.

Текущая cloud-конфигурация сохранена локально как `.modelence.cloud.env` и
может быть возвращена при необходимости.

## Проверки

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Production

```bash
pnpm build
pnpm start
```

`pnpm start` запускает production-сервер Modelence. Перед ним должна работать
локальная MongoDB или быть задана доступная production `MONGODB_URI`.

## Мобильное приложение

В репозитории есть заготовка Expo, но она пока не является полноценным
продуктовым клиентом. Текущий релизный фокус — адаптивный web/PWA.
