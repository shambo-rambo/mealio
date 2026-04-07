# Mealio — Product Requirements Document

**Smart Shopping & Meal Planning for Families**
Version 1.1 | April 2026 | Full Product Scope
 lsof -ti :3000 | xargs kill -9 2>/dev/null; lsof -ti :5173 | xargs kill -9 2>/dev/null; echo "Ports
   cleared"
---

## 1. Product Overview

Mealio is a Progressive Web App (PWA) built with React + TypeScript + Vite. It combines collaborative shopping lists, recipe management, and meal planning into a single family-shared experience, enhanced by AI for recipe import, nutritional analysis, and dietary tagging.

The core loop: plan meals on a shared calendar, pull ingredients from recipes directly into smart shopping lists, and share everything seamlessly across a family group.

Being a PWA means Mealio runs in the browser, can be installed to the home screen on iOS and Android like a native app, supports push notifications via the Web Push API, and accesses device hardware (camera, barcode scan) via browser APIs — with no app store required.

| | |
|---|---|
| **Platform** | Progressive Web App — runs in browser, installable on iOS and Android |
| **Frontend** | React + TypeScript + Vite |
| **Backend** | Node.js + Hono (TypeScript) |
| **Database** | SQLite locally via Drizzle ORM → PostgreSQL in production (same schema, config swap) |
| **AI Layer** | Anthropic Claude API — recipe parsing, nutrition, dietary tagging |
| **Auth** | JWT + bcrypt locally, no external auth service required for dev |
| **Real-time** | WebSockets locally (ws package) → Supabase Realtime or similar in production |
| **Notifications** | Web Push API |

---

## 2. Local Development Philosophy

The app is designed to run entirely on a developer's machine with zero external dependencies during development. Everything — database, backend, auth, real-time sync, file storage — runs locally. When ready to ship, each local component has a clear production swap.

### 2.1 Local Stack

| Local (Dev) | Production Swap | Notes |
|---|---|---|
| SQLite via Drizzle ORM | PostgreSQL (Neon, Supabase, Railway) | Drizzle makes this a one-line config change |
| Hono server on localhost:3000 | Deploy to Railway, Fly.io, or Vercel Edge | Same codebase |
| JWT auth (local secrets) | Same JWT, rotate secrets | No change needed |
| WebSockets (ws package) | Supabase Realtime or Ably | Swap the adapter |
| Local filesystem (`/uploads`) | Cloudflare R2 or AWS S3 | Swap the storage adapter |
| Web Push (self-hosted VAPID keys) | Same — Web Push is a standard | No change needed |

### 2.2 Getting Started Locally

The entire local environment starts with two commands:

```bash
# Install dependencies
npm install

# Start everything (backend + frontend + DB migration)
npm run dev
```

`npm run dev` runs concurrently:
- Vite dev server on `http://localhost:5173` (frontend)
- Hono API server on `http://localhost:3000` (backend)
- Drizzle migrations on first run (creates `mealio.db` SQLite file)

No Docker required. No cloud accounts required. The SQLite file is the entire database, stored at the project root as `mealio.db`.

### 2.3 Database Migrations

Drizzle ORM manages schema. Migrations are TypeScript files that run against SQLite locally and PostgreSQL in production — same migration files, both environments.

```bash
# Generate a migration after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open Drizzle Studio (visual DB browser) at localhost:4983
npm run db:studio
```

### 2.4 Testing PWA Features Locally

Some PWA features require HTTPS (push notifications, camera, install prompt). To test these locally:

- Run `npm run dev:https` — uses a self-signed cert via `vite-plugin-basic-ssl`
- Camera and barcode scan work at `https://localhost:5173`
- Push notifications work with local VAPID keys (generated once, stored in `.env`)
- PWA install prompt is available in Chrome and Edge via `localhost` (special-cased by browsers)

### 2.5 Environment Variables

```env
# .env (never committed — copy from .env.example)
DATABASE_URL=file:./mealio.db
JWT_SECRET=any_local_secret_here
ANTHROPIC_API_KEY=your_key_here
VAPID_PUBLIC_KEY=generated_once
VAPID_PRIVATE_KEY=generated_once
UPLOAD_DIR=./uploads
```

Production `.env` swaps `DATABASE_URL` to a PostgreSQL connection string and `UPLOAD_DIR` to an S3/R2 bucket reference. Everything else is identical.

---

## 3. PWA Capabilities

### 3.1 Installability

- Users visiting the app in Chrome or Safari are prompted to "Add to Home Screen"
- Once installed, Mealio appears on the home screen like a native app — full screen, no browser chrome
- App icon, splash screen, and theme colour defined in `manifest.json`
- Works on iOS (Safari) and Android (Chrome)

### 3.2 Camera and Barcode Scan

- Camera access via browser `getUserMedia` API — no native module required
- Barcode scanning via `@zxing/browser` library — decodes UPC/EAN from the camera feed in real time
- Photo capture for recipe import uses the same camera API
- On mobile, tapping a camera input field opens the native camera

### 3.3 Push Notifications

- Uses the Web Push API with VAPID keys (self-generated, stored in `.env`)
- Users are prompted to allow notifications on first use
- Notifications are sent server-side via the `web-push` npm package
- On iOS, push notifications require the app to be installed to the home screen (iOS 16.4+)

### 3.4 Home Screen Widget

- PWA does not support true native widgets — iOS/Android widgets require native code
- Replaced with a **shareable shopping list URL**: a lightweight, always-up-to-date read-only page optimised for quick viewing and quick-add
- On Android, a shortcut to the active list can be pinned to the home screen
- Revisited if the app moves to a React Native wrapper in future

### 3.5 Offline Behaviour

- Service worker (via `vite-plugin-pwa` / Workbox) caches the app shell and static assets
- Shopping list and recent recipes are cached for offline read access
- Write operations (add item, check off) are queued locally and synced when connection restores
- A visible offline indicator is shown when the app detects no network

---

## 4. Shopping List

### 4.1 Core List Behaviour

The shopping list is the heart of the app. Items can be added manually, via barcode scan, or pulled automatically from recipes on the meal planner.

| | |
|---|---|
| **Entry method** | Manual text entry with predictive suggestions based on previous entries. Barcode scan via browser camera API. |
| **Deduplication** | If an item already exists on the list, quantity is incremented rather than creating a duplicate entry. |
| **Barcode scan** | Scans UPC/EAN barcodes via `@zxing/browser`. Used for name auto-fill only — no product image database. User uploads images manually. |
| **From recipes** | Adding a recipe's ingredients to the list uses a checklist flow (see Section 6.5). |

### 4.2 List Views

Every shopping list has two view modes that share the same underlying data:

- **General List** — all items sorted by food category (produce, dairy, meat, bakery, etc.)
- **Store Tabs** — tabs across the top of the screen, one per store added by the family. Each tab shows only items assigned to that store, sorted by category within the store.
- Items with no store assigned appear on the General List only and do not appear in any store tab.
- Editing an item in any view (including checking it off or removing it) is reflected immediately in all views — same underlying record.

### 4.3 Store Assignment

- Family members can add named stores to their account (e.g. Coles, Woolworths, Farmers Market, Butcher).
- Each item can be assigned to one store. Assignment is optional.
- Store assignment defaults to the last-used store for that item. If user behaviour changes consistently, the new pattern becomes the default. A single different entry is not enough to update the default.
- Store assignment can be manually overridden per item at any time.

### 4.4 Per-Item Fields

Only the item name is required. All other fields are optional and accessible via an expanded item detail view.

| Field | Required | Notes |
|---|---|---|
| Item name | Yes | Free text. Predictive based on previous entries. |
| Quantity | No | Numeric. Scales with recipe if pulled from a recipe. |
| Package size | No | e.g. 500g, 1L, 6-pack |
| Category | No | Auto-suggested based on item name. User can override. Determines sort order. |
| Store | No | Assigned from family store list. Defaults to last-used store for that item. |
| Price | No | Single price field — user's own best price or target. No calculation or enforcement. |
| Image | No | User-uploaded photo. Helps family identify correct product/brand. |
| Item note | No | Free text note on the item. e.g. 'Get the no-added-salt version'. |

### 4.5 Checking Off Items

- Tapping an item marks it as purchased — it moves to the bottom of the list with a strikethrough style.
- Items can be unchecked. Completing a shop does not auto-delete items — user clears the list manually or selectively.
- All check-off actions sync instantly to all family members via WebSocket and trigger a push notification.

### 4.6 Multiple Lists

- A family can maintain multiple named shopping lists (e.g. Weekly Shop, Costco Run, Party Supplies).
- When adding recipe ingredients to the shopping list, the user selects which list to add to.
- Each list has its own General view and store tabs.

### 4.7 Quick-Add Shortcut

- A shareable URL for each list provides a lightweight quick-add view
- Optimised for mobile browser — single input, no navigation, instant add
- Replaces the native widget which is not available in PWA

---

## 5. Recipe Library

### 5.1 Recipe Data Model

| Field | Notes |
|---|---|
| Title | Recipe name. Required. |
| From (Source URL) | Automatically captured on URL import. Displayed as attribution link. |
| Picture | User-uploaded photo. Stored in local `/uploads` folder in dev, S3/R2 in production. |
| Rating | Shared family rating, 1–5 stars. All family members can rate; ratings are averaged. |
| Collections | Tag-based. A recipe can belong to multiple collections. Collections are created and shared by family members. |
| Last prepared | Auto-populated from meal planner. Displays most recent date and total times made. e.g. 'Made 3 times, last 14 March'. |
| Prep time | In minutes. Captured on import or entered manually. |
| Cook time | In minutes. Captured on import or entered manually. |
| Servings | Base serving count. Used for scaling calculations. |
| Ingredients | List of ingredients with quantity, unit, name, and optional preparation note (e.g. 'finely diced'). |
| Steps | Numbered method steps. |
| Notes | User's own free-text notes on the recipe. |
| Dietary tags | Auto-generated by AI based on ingredients. e.g. Vegetarian, Gluten Free, Dairy Free, Nut Free, Vegan. User can edit. |
| Nutrition | AI-estimated per serving: calories, protein, carbohydrates, fat. Scales with serving size adjustment. |
| Scale | Serving multiplier. 1 = as written, 0.5 = half, 2 = double. Also supports scale-by-ingredient (see 5.4). |

### 5.2 Recipe Import

Recipes can be imported via three methods, all processed by the AI layer:

- **URL import** — paste a recipe URL. Backend fetches the page content server-side and AI parses it regardless of site structure.
- **Photo import** — photograph a recipe from a cookbook, magazine, or handwritten card. Image sent to Claude API with vision. AI reads and parses the content.
- **Text paste** — copy and paste raw recipe text. AI extracts structured data.

All three methods route through the same post-import review screen before saving. The user reviews and corrects any misread fields before the recipe is saved to the library.

### 5.3 Manual Recipe Creation

A blank version of the same form used in post-import review is available for creating recipes from scratch. Dietary tags and nutrition are generated by AI on save.

### 5.4 Recipe Scaling

Two scaling methods are available:

- **Serving-based scaling** — change the multiplier (0.5, 1, 2, 3 etc.) and all ingredients scale proportionally.
- **Scale-by-ingredient** — select a single ingredient, change its quantity (e.g. 'I only have 2 eggs, not 4'), and all other ingredients scale to match that ratio automatically.

Scaled quantities are rounded to the nearest sensible unit (e.g. 2 tsp not 0.667 tbsp). Where rounding has occurred, an approximation indicator (~) is displayed next to the quantity.

### 5.5 Cook Mode

A dedicated cook mode is available from any recipe. It shows a distraction-free, step-by-step view with the screen kept on via the `navigator.wakeLock` browser API. The current step is highlighted. Users tap to advance to the next step.

### 5.6 Recipe Sharing

Any recipe can be shared outside the family via a public link. Recipients can view the recipe in a browser or, if they have the app, import it directly into their own library.

### 5.7 Collections

- Collections are shared tags. Any family member can create a collection.
- A recipe can belong to multiple collections simultaneously.
- Collections appear as filter options in the recipe library view.
- The library can also be filtered by meal label (Breakfast / Lunch / Dinner), dietary tag, and searched by name.

---

## 6. Meal Planning

### 6.1 Calendar View

- The meal planner is a shared family calendar viewable in week and month modes.
- All family members can view and edit the meal plan.
- Simultaneous edits from multiple family members are both saved. A push notification is sent to all family members when the meal plan changes, and conflicts are resolved by the family.

### 6.2 Adding Meals to a Day

Tapping a day opens a day detail view. From here the user can add:

- A saved recipe from the family recipe library
- A plain text note (free text only — no ingredients, no shopping list integration)

Each meal entry is labelled Breakfast, Lunch, or Dinner, and entries are displayed in that order within the day.

### 6.3 Day Notes

Separate from meal entries, each day has a free-text day note field (e.g. 'We are out tonight — just cook for the kids'). This is day-level only and does not affect meal entries.

### 6.4 Recurring Meals

- Any recipe or note added to a day can be set to recur: daily, weekly, fortnightly, or on specific days of the week (e.g. every Monday and Wednesday).
- Recurring entries auto-populate the calendar forward indefinitely until cancelled.
- An individual occurrence can be edited or removed without affecting the rest of the series — identical behaviour to recurring events in Google Calendar.

### 6.5 Adding Recipe Ingredients to the Shopping List

Tapping a recipe on the meal planner opens a checklist of all its ingredients. The flow:

- All ingredients are selected by default.
- User deselects any ingredients they already have.
- User taps Add to List.
- If the family has multiple shopping lists, the user selects which list to add to.
- Items already on the selected list are not duplicated — quantities are incremented instead.
- The serving scale can be adjusted on this screen before adding.

---

## 7. Family Groups

### 7.1 Structure

| | |
|---|---|
| **One family per user** | A user can belong to exactly one family group at a time. |
| **Owner** | One owner per family. The owner cannot be removed by admins. |
| **Admins** | Multiple admins supported. Admins can invite members, remove members, and manage family settings. |
| **Members** | Standard family members. Full access to all content — no restrictions. |
| **Permissions** | Flat — all members can create, edit, and delete any shared content. |

### 7.2 Joining a Family

- Invite via shareable link
- Invite via 6-digit join code
- Invite via email address

### 7.3 Shared Content

All of the following are shared across the family group:

- Shopping lists (all lists, all items)
- Recipe library
- Recipe collections
- Meal plan
- Store list

There is no private content within a family group. Everything is visible and editable by all members.

### 7.4 Leaving / Removal

- If a member leaves or is removed, all content they created remains in the family pool.
- A removed member loses access immediately.
- The owner cannot be removed — ownership must be transferred first.

### 7.5 Push Notifications

Push notifications sent via Web Push API to all family members on any change to shared content, including:

- Shopping list item added, removed, or checked off
- Recipe added or edited
- Meal plan updated
- New collection created
- Family member joined or left

---

## 8. AI Features

All AI features use the Anthropic Claude API (`claude-sonnet-4-20250514`). All API calls are made server-side — the API key is never exposed to the browser.

| Feature | Description |
|---|---|
| **Recipe import parsing** | Given a URL (fetched server-side), photo, or pasted text, AI extracts: title, source URL, servings, prep time, cook time, ingredients (with quantities, units, and prep notes), and method steps. Returns structured JSON for the post-import review screen. |
| **Nutrition calculation** | Given an ingredient list with quantities, AI estimates per-serving macros: calories, protein, carbohydrates, and fat. Recalculates when serving scale changes. |
| **Dietary tagging** | Given an ingredient list, AI auto-generates dietary tags: Vegetarian, Vegan, Gluten Free, Dairy Free, Nut Free. Tags are editable by the user after generation. |
| **Item category suggestion** | When a new shopping list item is entered manually, AI suggests the food category if not already known from history. |

---

## 9. Core Data Model

### 9.1 SQLite Schema (Drizzle ORM)

All tables are defined in TypeScript via Drizzle ORM. The same schema runs against SQLite in development and PostgreSQL in production with no changes to migration files.

```
users              id, name, email, passwordHash, avatar, familyId, role, createdAt
families           id, name, ownerId, createdAt
stores             id, name, familyId
shopping_lists     id, name, familyId, createdAt
shopping_items     id, listId, name, quantity, packageSize, category, storeId,
                   price, imageUrl, note, checked, recipeSourceId, createdBy, updatedAt
recipes            id, familyId, title, sourceUrl, pictureUrl, prepTime, cookTime,
                   servings, notes, createdBy, lastPreparedAt, preparedCount, createdAt
ingredients        id, recipeId, name, quantity, unit, prepNote, sortOrder
recipe_steps       id, recipeId, instruction, sortOrder
recipe_ratings     id, recipeId, userId, rating
collections        id, name, familyId, createdBy
recipe_collections recipeId, collectionId
dietary_tags       id, recipeId, tag
nutrition          id, recipeId, calories, protein, carbs, fat, perServings
meal_plan          id, familyId, date, mealLabel, recipeId, noteText,
                   isRecurring, recurrenceRule, parentId, createdBy
push_subscriptions id, userId, endpoint, p256dh, auth
item_history       id, familyId, name, category, storeId
```

### 9.2 Key Relationships

- A shopping_item belongs to one shopping_list
- A recipe belongs to one family and can belong to many collections via recipe_collections
- A meal_plan entry references one recipe or contains noteText
- A shopping_item may reference a recipeSourceId for traceability
- Recurring meal_plan entries reference a parentId (the original entry)

---

## 10. API Structure

RESTful JSON API served by Hono on Node.js. All routes prefixed `/api/v1`. All routes except auth require a valid JWT in the `Authorization: Bearer` header.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout

GET    /api/v1/family
POST   /api/v1/family
POST   /api/v1/family/invite
POST   /api/v1/family/join

GET    /api/v1/lists
POST   /api/v1/lists
GET    /api/v1/lists/:id
PATCH  /api/v1/lists/:id
DELETE /api/v1/lists/:id
GET    /api/v1/lists/:id/items
POST   /api/v1/lists/:id/items
PATCH  /api/v1/lists/:id/items/:itemId
DELETE /api/v1/lists/:id/items/:itemId

GET    /api/v1/recipes
POST   /api/v1/recipes
GET    /api/v1/recipes/:id
PATCH  /api/v1/recipes/:id
DELETE /api/v1/recipes/:id
POST   /api/v1/recipes/import
POST   /api/v1/recipes/:id/rate

GET    /api/v1/meal-plan?start=&end=
POST   /api/v1/meal-plan
PATCH  /api/v1/meal-plan/:id
DELETE /api/v1/meal-plan/:id

GET    /api/v1/collections
POST   /api/v1/collections
DELETE /api/v1/collections/:id

POST   /api/v1/push/subscribe
POST   /api/v1/push/unsubscribe
```

WebSocket endpoint: `ws://localhost:3000/ws` — authenticated via JWT on connect, broadcasts all mutation events to connected family members in real time.

---

## 11. Full Feature List

### Shopping List
- Manual item entry with predictive suggestions from history
- Barcode scan to add items via browser camera API (`@zxing/browser`)
- No-duplicate logic — increments quantity if item already exists
- General list view sorted by food category
- Store tabs — filter list by assigned store
- Bidirectional — edits in any view reflect everywhere
- Per-item fields: name, quantity, package size, category, store, price, image, note
- Store assignment with smart defaulting to last-used pattern
- Mark items as purchased — moves to bottom with strikethrough
- Multiple named shopping lists per family
- Add recipe ingredients via checklist flow with list selector
- Quick-add shortcut URL (replaces native widget for PWA)
- Offline support — queue writes, sync on reconnect

### Recipe Library
- Import via URL, photo, or text paste — AI-powered parsing
- Post-import review screen before saving
- Manual recipe creation (blank form)
- Full recipe data model: title, source, picture, rating, collections, last prepared, prep time, cook time, servings, ingredients, steps, notes
- Shared family star rating (1–5)
- Collections — multi-tag, family-shared, user-created
- Dietary tags — AI auto-generated, user-editable
- Nutrition — AI-estimated calories and macros per serving
- Serving-based scaling with ~ indicator for rounded values
- Scale-by-ingredient — anchor scale to a specific ingredient's available quantity
- Cook mode — distraction-free step-by-step with screen wake lock
- Recipe share via public link
- Last prepared date and made count auto-updated from meal planner
- Filter by meal label, dietary tag, collection; search by name

### Meal Planner
- Shared family calendar — week and month views
- Add recipes or plain text notes to any day
- Breakfast / Lunch / Dinner labels, displayed in order
- Day-level free text note
- Recurring meals: daily, weekly, fortnightly, or specific days
- Edit individual occurrence without breaking series
- Add recipe ingredients to shopping list from meal planner entry
- Select servings and which shopping list when adding ingredients
- Simultaneous edits both saved, push notification sent to all

### Family Groups
- Single family group per user
- One owner, multiple admins, unlimited members
- Invite via link, code, or email
- Flat permissions — all members can do everything
- All content shared: lists, recipes, collections, meal plan, stores
- Content stays in family pool when a member leaves
- Push notifications for all content changes (Web Push API)

### AI
- Recipe parsing from URL, photo, and text
- Nutritional estimation (calories, protein, carbs, fat)
- Dietary tag generation
- Shopping list item category suggestion

### PWA
- Installable to iOS and Android home screen
- Offline read access with write queue
- Web Push notifications
- Camera and barcode scan via browser APIs
- Screen wake lock in cook mode

---

## 12. Explicitly Out of Scope

- Pantry tracking
- Shopping history / past completed lists
- Budget totalling
- Meal plan week templates
- Product image database
- Multiple family groups per user
- Private content within a family group
- Native iOS/Android app (PWA first, native wrapper later if needed)
- Native home screen widget (replaced by quick-add URL)

---

## 13. Technical Stack

### Frontend

| | |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build tool** | Vite |
| **Styling** | Tailwind CSS |
| **PWA** | vite-plugin-pwa (Workbox) |
| **State management** | Zustand |
| **Data fetching** | TanStack Query (React Query) |
| **Routing** | React Router v6 |
| **Barcode scan** | @zxing/browser |
| **Camera** | Browser getUserMedia API |
| **Calendar** | react-big-calendar or custom |

### Backend

| | |
|---|---|
| **Runtime** | Node.js 20+ |
| **Framework** | Hono (TypeScript) |
| **ORM** | Drizzle ORM |
| **Database (local)** | SQLite (`mealio.db`) |
| **Database (production)** | PostgreSQL (Neon / Supabase / Railway) |
| **Auth** | JWT (jose) + bcrypt |
| **Real-time (local)** | ws (WebSockets) |
| **Real-time (production)** | Supabase Realtime or Ably |
| **File storage (local)** | Local filesystem (`/uploads`) |
| **File storage (production)** | Cloudflare R2 or AWS S3 |
| **Push notifications** | web-push (VAPID) |
| **AI** | Anthropic Claude API (`claude-sonnet-4-20250514`) |

### Dev Tooling

| | |
|---|---|
| **Package manager** | npm or pnpm |
| **Monorepo structure** | Single repo, `/client` and `/server` directories |
| **Concurrency** | concurrently (runs client + server together via `npm run dev`) |
| **DB browser** | Drizzle Studio (`npm run db:studio`) |
| **HTTPS (local)** | vite-plugin-basic-ssl (`npm run dev:https`) |
| **Linting** | ESLint + Prettier |
| **Testing** | Vitest (unit) + Playwright (e2e) |

### Production Deployment

| | |
|---|---|
| **Frontend** | Vercel or Cloudflare Pages |
| **Backend** | Railway, Fly.io, or Render |
| **Database** | Neon (serverless PostgreSQL) or Supabase |
| **Storage** | Cloudflare R2 |

---

## 14. Project Structure

```
mealio/
├── client/                      # React frontend
│   ├── public/
│   │   └── manifest.json        # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── store/               # Zustand stores
│   │   ├── lib/                 # API client, utils
│   │   └── service-worker.ts    # Workbox service worker
│   └── vite.config.ts
│
├── server/                      # Hono backend
│   ├── src/
│   │   ├── routes/              # API route handlers
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle schema (SQLite + PG compatible)
│   │   │   └── migrations/
│   │   ├── lib/
│   │   │   ├── ai.ts            # Claude API calls
│   │   │   ├── push.ts          # Web Push helpers
│   │   │   └── storage.ts       # File storage adapter (local / S3)
│   │   └── ws.ts                # WebSocket server
│   └── drizzle.config.ts
│
├── mealio.db                    # SQLite file — local dev only, gitignored
├── uploads/                     # Local file storage — gitignored
├── .env                         # Local env vars — gitignored
├── .env.example                 # Template committed to repo
└── package.json                 # Root scripts: dev, build, db:generate, db:migrate, db:studio
```

---

*End of Document — Version 1.1*
