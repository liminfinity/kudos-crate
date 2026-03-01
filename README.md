# МИРА

**Добавь в свой проект больше мира.**

Платформа корпоративной обратной связи и развития команд.

## Возможности

- Обратная связь между коллегами
- Благодарности — система признания вклада
- Состояние атмосферы — индекс настроения компании
- Серьёзные сигналы — отслеживание инцидентов
- Полугодовые опросы и дневник руководителя
- AI-обработка текстов (орфография, тон, смысл)
- AI-ассистент МИРА — контекстная помощь

## Технологии

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Lovable Cloud (база данных, аутентификация, edge functions)
- Lovable AI Gateway (обработка текста, ассистент)

## Запуск через Docker

### Разработка

```bash
cp .env.example .env
# Заполните переменные в .env
docker compose up --build
```

Приложение доступно на `http://localhost:5173` с hot reload.

### Production

```bash
cp .env.example .env.production
# Заполните переменные для production
docker compose -f docker-compose.prod.yml up --build -d
```

Приложение доступно на `http://localhost` (nginx → порт 80).

### Полезные команды

```bash
# Остановить
docker compose down

# Миграции (при использовании локальной БД)
docker compose exec app sh /app/scripts/docker-entrypoint.sh

# Проверка здоровья
curl http://localhost:3000/health
```

### Переменные окружения

| Переменная | Описание |
|---|---|
| `VITE_SUPABASE_URL` | URL бэкенда |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Публичный ключ |
| `VITE_SUPABASE_PROJECT_ID` | ID проекта |
| `DATABASE_URL` | Строка подключения к PostgreSQL (для локальной БД) |
| `JWT_SECRET` | Секрет аутентификации |
| `APP_URL` | URL приложения |
| `LOVABLE_API_KEY` | Ключ AI Gateway |
| `CRON_ENABLED` | Включить расписание опросов |
| `NODE_ENV` | `development` / `production` |
