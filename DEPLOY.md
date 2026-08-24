# Деплой

**Хостинг:** GitHub Pages (Vercel/Netlify CLI недоступны на этой машине —
нет `node`/`npm`/`npx`; `gh` был уже авторизован, поэтому использован он).

**Репозиторий:** https://github.com/tommfreeman91-beep/oksana-funnel-prototype
(отдельный git-репозиторий, живёт прямо в папке `app/` — не в корне проекта).

## Публичная ссылка (вставлять в BotFather → Menu Button)

```
https://tommfreeman91-beep.github.io/oksana-funnel-prototype/
```

## Как задеплоить заново после правок в `app/`

**Если менял `styles.css` или `app.js` — сначала бампни версию** в
`index.html` (сейчас `?v=3`): найди `styles.css?v=3` и `app.js?v=3` и
увеличь число в обоих местах. Без этого Telegram-WebView может продолжать
показывать старую закэшированную версию файла даже после перезапуска
приложения — так уже случалось (кнопка навигации и автоподстановка
username не появлялись, пока не сменился URL файла).

```bash
cd "app"
git add -A
git commit -m "Update prototype"
git push
```

Всё — GitHub Pages сам пересоберёт статику из ветки `main` за 20–60
секунд, ссылка остаётся той же. Ничего больше запускать не нужно
(Pages уже включён на этот репозиторий, источник — `main` / `/`).

## Если нужно проверить, что деплой прошёл

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://tommfreeman91-beep.github.io/oksana-funnel-prototype/
# 200 — значит отдаётся
```

## Как это было поднято первый раз (для справки, повторять не нужно)

```bash
cd "app"
git init -b main
git add -A
git commit -m "Static prototype of the Telegram Mini App funnel screens"
gh repo create oksana-funnel-prototype --public --source=. --remote=origin --push
touch .nojekyll && git add .nojekyll && git commit -m "Disable Jekyll processing for GitHub Pages"
git push
gh api -X POST repos/tommfreeman91-beep/oksana-funnel-prototype/pages \
  -f "source[branch]=main" -f "source[path]=/"
```

## Заметки

- Репозиторий публичный (бесплатный GitHub Pages требует public-репозиторий
  на обычном аккаунте). В нём нет токенов/секретов — только статика
  прототипа (`index.html`, `styles.css`, `app.js`, фото). Файл `.env` с
  токеном бота лежит в корне проекта `Апка Оксана/.env`, **не** в этом
  репозитории и не пушится.
- Все пути в `index.html`/`styles.css` относительные, поэтому страница
  нормально работает под путём `/oksana-funnel-prototype/` (не в корне
  домена).
