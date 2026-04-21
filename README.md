# OncoAssistant

Приложение для ведения онкоконсультации: паспортная часть, анамнез, осмотр, обследования, AI-диагноз, план лечения и назначения.

## Быстрый старт (локально)

Требования:
- Node.js 20+
- npm

Шаги:
1. Установить зависимости:
   ```bash
   npm install
   ```
2. Создать `.env.local` на основе `.env.example` и при необходимости указать ключ:
   ```env
   API_KEY=...
   ```
3. Запустить приложение:
   ```bash
   npm run dev
   ```
4. Открыть:
   `http://localhost:3000`

## Полезные команды

```bash
npm run dev
npm run lint
npm run lint:strict
npm run build
npm run check
npm run check:strict
npm run start
```

`npm run start` запускает сервер через `tsx server.ts`.  
Для production-режима установите `NODE_ENV=production`.

## Проверка кода (ESLint)

- `npm run lint` показывает предупреждения и ошибки.
- `npm run lint:strict` завершится ошибкой даже при предупреждениях.
- `npm run check` = lint + build.
- `npm run check:strict` = strict lint + build.

Если хотите видеть больше сигналов в локальной работе, используйте `npm run lint` перед каждым коммитом.

## Запуск двойным кликом (Windows)

В проект добавлен файл:
- `start-oncoassistant.bat`

Что делает:
- проверяет наличие Node.js;
- при необходимости ставит зависимости;
- открывает браузер;
- запускает `npm run dev`.

Можно запускать как обычный `.bat` двойным кликом.

## Деплой на VPS / удаленный сервер

### Вариант A: без Docker

```bash
git clone https://github.com/a1mail/VSC_Oncoassistant.git
cd VSC_Oncoassistant
npm ci
npm run build
NODE_ENV=production npm run start
```

Рекомендуется запускать через PM2/systemd и использовать nginx как reverse-proxy.

### Вариант B: Docker

Сборка и запуск:

```bash
docker build -t oncoassistant .
docker run -d --name oncoassistant -p 3000:3000 \
  -e NODE_ENV=production \
  -e API_KEY=your_key \
  oncoassistant
```

### Вариант C: Docker Compose

```bash
docker compose up -d --build
```

Остановка:

```bash
docker compose down
```

## GitHub и CI

В репозитории добавлен workflow:
- `.github/workflows/ci.yml`
- `.github/workflows/docker-image.yml`

Что делает CI:
- `npm ci`
- `npm run lint`
- `npm run build`

Запускается на каждый `push` и `pull_request`.

Публикация Docker-образа:
- при push в `main` собирается и публикуется образ в GHCR:
  `ghcr.io/<ваш_аккаунт>/vsc_oncoassistant:latest`

## Как развернуть через GitHub

GitHub Pages для этого проекта не подходит, но GitHub отлично подходит как источник деплоя:

1. Хранить код в GitHub.
2. Собирать образ через GitHub Actions в GHCR.
3. На сервере запускать контейнер из GHCR.

Пример на сервере:

```bash
docker login ghcr.io
docker pull ghcr.io/a1mail/vsc_oncoassistant:latest
docker run -d --name oncoassistant -p 3000:3000 \
  -e NODE_ENV=production \
  -e API_KEY=your_key \
  ghcr.io/a1mail/vsc_oncoassistant:latest
```

Для автообновления на сервере:
- `scripts/deploy.sh` (Linux)
- `scripts/deploy.ps1` (Windows)

## Что важно про GitHub Pages

GitHub Pages подходит только для статических сайтов.  
Это приложение содержит backend (`server.ts`) и SQLite, поэтому для полноценной работы лучше использовать:
- VPS (Ubuntu + nginx + PM2/systemd)
- Render / Railway / Fly.io
- Docker-хостинг
