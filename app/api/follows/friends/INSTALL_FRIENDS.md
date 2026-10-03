# 👥 Система друзей для PlayLog — Инструкция по установке

## 📦 Что создано

Все файлы находятся в папке `playlog-patches/friends/`:

```
playlog-patches/friends/
├── app/
│   ├── api/
│   │   └── follows/
│   │       └── list/
│   │           └── route.ts          ← НОВЫЙ API для списка подписок
│   ├── friends/
│   │   └── page.tsx                  ← НОВАЯ страница друзей
│   └── feed/
│       └── page.tsx                  ← НОВАЯ лента активности
└── components/
    └── Header.tsx                    ← ОБНОВЛЁН (добавлена ссылка "Друзья")
```

---

## 🚀 Быстрая установка (одна команда)

Откройте терминал в корне проекта и выполните:

```bash
# Создать папки и скопировать все файлы
mkdir -p app/api/follows/list app/friends app/feed && \
cp playlog-patches/friends/app/api/follows/list/route.ts app/api/follows/list/ && \
cp playlog-patches/friends/app/friends/page.tsx app/friends/ && \
cp playlog-patches/friends/app/feed/page.tsx app/feed/ && \
cp playlog-patches/friends/components/Header.tsx components/
```

---

## 📋 Пошаговая установка

### Шаг 1: Создайте папку для API

```bash
mkdir -p app/api/follows/list
```

### Шаг 2: Скопируйте API route

```bash
cp playlog-patches/friends/app/api/follows/list/route.ts app/api/follows/list/route.ts
```

**Что делает:** API для получения списка подписок и подписчиков пользователя.

---

### Шаг 3: Создайте папку friends

```bash
mkdir -p app/friends
```

### Шаг 4: Скопируйте страницу друзей

```bash
cp playlog-patches/friends/app/friends/page.tsx app/friends/page.tsx
```

**Что делает:** Страница `/friends` с двумя табами:
- **Подписки** — на кого вы подписаны
- **Подписчики** — кто подписан на вас

Функции:
- Поиск по нику в списке
- Кнопка "Отписаться" / "Подписаться в ответ"
- Аватары, уровни, время подписки
- Пустые состояния с CTA

---

### Шаг 5: Создайте папку feed

```bash
mkdir -p app/feed
```

### Шаг 6: Скопируйте ленту активности

```bash
cp playlog-patches/friends/app/feed/page.tsx app/feed/page.tsx
```

**Что делает:** Страница `/feed` с лентой активности друзей.
- Использует компонент `ActivityFeed` с `scope="feed"`
- Показывает события от людей, на которых вы подписаны
- Пустое состояние с ссылкой на `/friends`

---

### Шаг 7: Замените Header.tsx

```bash
cp playlog-patches/friends/components/Header.tsx components/Header.tsx
```

**Что изменено:**
- Добавлена ссылка "Друзья" в десктопную навигацию
- Добавлена ссылка "Друзья" в мобильное меню
- Добавлена ссылка "Друзья" в выпадающее меню пользователя

---

### Шаг 8: Перезапустите сервер

```bash
npm run dev
```

---

## ✅ Что проверить после установки

1. ✅ В навигации появилась ссылка "Друзья"
2. ✅ Страница `/friends` открывается без ошибок
3. ✅ Табы "Подписки" и "Подписчики" переключаются
4. ✅ Кнопка "Подписаться" на чужом профиле работает
5. ✅ Лента `/feed` показывает активность
6. ✅ Нет ошибок в консоли браузера

---

## 🎯 Как это работает

### Модель данных

**Подписки (односторонние, как в Twitter):**
- Таблица `follows` уже существует
- `follower_id` подписан на `following_id`
- Никаких заявок и подтверждений

**Лента активности:**
- Таблица `activity_feed` уже существует
- События записываются при действиях пользователя
- API `/api/activity?scope=feed` возвращает события от подписок

### Поток данных

```
1. Пользователь сохраняет статус игры
   ↓
2. API пишет событие в activity_feed
   ↓
3. Подписчик открывает /feed
   ↓
4. GET /api/activity?scope=feed
   ↓
5. Supabase возвращает события от подписок
   ↓
6. Компонент ActivityFeed рендерит ленту
```

---

## 🔧 API Endpoints

### GET /api/follows/list

**Параметры:**
- `user_id` — ID пользователя
- `type` — `following` или `followers`

**Ответ:**
```json
{
  "users": [
    {
      "id": "uuid",
      "nickname": "Катя",
      "full_name": "Екатерина",
      "avatar_url": "https://...",
      "xp": 3155,
      "followed_at": "2026-10-02T12:00:00Z"
    }
  ]
}
```

---

## 🎨 Компоненты

### FriendsPage (`app/friends/page.tsx`)

**Функции:**
- Два таба: "Подписки" / "Подписчики"
- Поиск по нику
- Карточки пользователей с аватарами
- Кнопки "Отписаться" / "Подписаться в ответ"
- Пустые состояния
- Счётчики в табах

**Состояния:**
- Не авторизован → предложение войти
- Загрузка → спиннер
- Пустой список → CTA "Найти игроков"
- Список загружен → карточки пользователей

---

### FeedPage (`app/feed/page.tsx`)

**Функции:**
- Заголовок "Лента"
- Компонент `ActivityFeed` с `scope="feed"`
- Показывает активность от подписок
- Пустое состояние → ссылка на `/friends`

---

## 🐛 Возможные проблемы

### Проблема: "Cannot find module '@/components/ActivityFeed'"

**Решение:** Убедитесь, что файл `components/ActivityFeed.tsx` существует в вашем проекте.

---

### Проблема: Ошибка 404 на `/friends`

**Решение:** Проверьте, что файл `app/friends/page.tsx` создан и сервер перезапущен.

---

### Проблема: Список подписок пустой

**Решение:** 
1. Проверьте, что в таблице `follows` есть записи
2. Проверьте консоль браузера на ошибки API
3. Убедитесь, что `user_id` передаётся правильно

---

## 📊 Следующие шаги (опционально)

### 1. Добавить счётчики в ProfileHeader

Расширить `ProfileHeader.tsx`:
- Добавить пропсы `followingCount` и `followersCount`
- Показать "12 подписчиков · 34 подписки"
- Клики → `/friends?tab=followers` и `/friends`

### 2. Запись событий в activity_feed

Добавить в `app/page.tsx`, `app/my-games/page.tsx`, `app/releases/page.tsx`:

```typescript
// При сохранении игры
if (oldStatus !== newStatus) {
  fetch('/api/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      type: 'completed', // или 'started', 'dropped', 'added'
      gameId: game.id,
      gameTitle: game.title,
      gameCover: game.cover,
      hours: newHours,
    }),
  });
}
```

### 3. Уведомления

Добавить систему уведомлений при новых подписках и действиях друзей.

---

## 🎉 Готово!

Система друзей полностью реализована:
- ✅ Подписки (односторонние, как в Twitter)
- ✅ Страница `/friends` с табами
- ✅ Лента `/feed` с активностью друзей
- ✅ API для списка подписок/подписчиков
- ✅ Навигация в Header

Все файлы готовы к копированию в папке `playlog-patches/friends/`.

**Удачи с проектом!** 🚀🎮
