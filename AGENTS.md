# Dished

Static recipe-sharing site. No build step: plain HTML, Tailwind via the Play CDN,
Phosphor icons, DiceBear avatars, and vanilla JS with `localStorage` /
`sessionStorage` standing in for a backend.

## Writing rules

- **Never use em dashes or en dashes** (U+2014, U+2013) in any output: page copy,
  code comments, commit messages, or replies. Use a comma, colon, full stop, or
  parentheses instead. A plain hyphen in compound words (gluten-free) is fine.

## Project layout

| File | Purpose |
| --- | --- |
| `theme.js` | Loads the webfonts and Phosphor icon sets, and defines the Tailwind palette. Include after the Tailwind CDN script. |
| `style.css` | Component layer: buttons, fields, pills, cards, sidebar, drawer, modal, toasts. Tailwind utilities handle layout in the markup. |
| `app.js` | Shared runtime. Seed data, fake auth, cart, likes, lists, ratings, settings, orders, notifications, toasts, recipe cards, and the app shell. |
| `index.html` `welcome.html` `sign.html` | Public pages. No app shell. |
| `home.html` `recipe.html` `profile.html` `lists.html` `reviews.html` `settings.html` | App pages. Each calls `Dished.mountShell()` then `Dished.mountTopbar()`. |

`Dished.mountShell()` injects the sidebar, basket drawer, recipe composer,
checkout modal, save-to-list picker, notifications panel and toast stack, so no
page repeats that markup.

## Conventions

- Brand colours live in the Tailwind config as `sage` (green `#5b8266`) and
  `cream` (`#fdfcd7`). Headings use DM Serif Display, UI text uses DM Sans.
- Repeated UI belongs in `app.js` or `style.css`, never copied across pages.
- No `alert()`, `confirm()`, or `prompt()`. Use `Dished.toast()`, with an
  `action` for undo where a change is destructive.
- Escape anything user-supplied with `Dished.esc()` before putting it in HTML.
- Page-level element ids must not clash with shell ids (`stat-recipes`,
  `stat-liked`, `cart-*`, `alerts-*` and friends). Prefix page stats instead.
- Everything is a demo, and it says so on screen. The checkout uses pre-saved
  placeholder payment methods; there is no field anywhere to enter a real card,
  and it must stay that way.
- Prices are Iraqi Dinar via `Dished.money.format()`.
