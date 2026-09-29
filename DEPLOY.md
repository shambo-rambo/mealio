# Mealio — Deployment Guide

## Status: LIVE

| Service | URL |
|---------|-----|
| **App (frontend)** | https://mealio.pages.dev |
| **API (backend)** | https://mealio-api.simon-hamblin.workers.dev |

---

## Cost

Hosted entirely on **Cloudflare** (your cheapest viable option for this stack):

| Service | Plan | Cost |
|---------|------|------|
| Cloudflare Pages (frontend) | Free | $0 |
| Cloudflare Workers (API) | **Paid** (required for Durable Objects / real-time sync) | **$5/month** |
| Cloudflare D1 (database) | Included in Workers Paid | $0 |
| Cloudflare R2 (file storage) | Free tier: 10GB / 1M ops/month | $0 |

**Total: $5/month.** If you haven't already, upgrade at https://dash.cloudflare.com — go to Workers & Pages → Plans → Workers Paid.

---

## Install on your phone

### iPhone (Safari required)
1. Open **https://mealio.pages.dev** in Safari
2. Tap the **Share** button (box with arrow at bottom of screen)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** — Mealio appears on your home screen like a native app

### Android (Chrome)
1. Open **https://mealio.pages.dev** in Chrome
2. Tap the **three-dot menu** (top right)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **"Install"**

---

## Architecture (what's deployed where)

```
Phone/Browser
    │
    ▼
Cloudflare Pages (mealio.pages.dev)
    React + Vite PWA — static files, service worker, offline cache
    │
    │  API calls to /api/v1/*
    │  WebSocket to /ws
    ▼
Cloudflare Workers (mealio-api.simon-hamblin.workers.dev)
    Hono API — auth, recipes, lists, meal plan, push notifications
    ├── D1 Database — SQLite (all app data)
    ├── R2 Bucket — file uploads (recipe images)
    └── Durable Object (FamilyRoom) — real-time WebSocket sync
```

---

## Secrets (already set in Cloudflare)

These are set as Worker secrets — you don't need to touch them again unless you rotate keys:

- `JWT_SECRET` — signs auth tokens
- `ANTHROPIC_API_KEY` — Claude AI for recipe import
- `VAPID_PUBLIC_KEY` — push notification signing
- `VAPID_PRIVATE_KEY` — push notification signing
- `VAPID_EMAIL` — push notification sender identity
- `INSTAGRAM_TOKEN` — Instagram oEmbed for recipe import

To view or update: `npx wrangler secret list` / `npx wrangler secret put <NAME>`

---

## Redeploy (after code changes)

### Deploy API changes
```bash
cd server
npx wrangler deploy
```

### Deploy frontend changes
```bash
# From repo root
VITE_API_URL=https://mealio-api.simon-hamblin.workers.dev npm run build --workspace=client
npx wrangler pages deploy client/dist --project-name mealio --commit-dirty=true
```

### Both at once
```bash
VITE_API_URL=https://mealio-api.simon-hamblin.workers.dev npm run build
npx wrangler pages deploy client/dist --project-name mealio --commit-dirty=true
cd server && npx wrangler deploy
```

---

## Database migrations

The production D1 database is already migrated and has all tables.

To apply new migrations after schema changes:
```bash
# Generate migration from schema diff
npm run db:generate

# Apply to production
cd server && npx wrangler d1 migrations apply mealio --remote
```

---

## Logs & debugging

Stream live API logs:
```bash
npx wrangler tail
```

Query production database directly:
```bash
npx wrangler d1 execute mealio --remote --command "SELECT * FROM users LIMIT 5"
```

---

## Custom domain (optional, future)

If you want `app.yourdomain.com` instead of `mealio.pages.dev`:
1. Go to https://dash.cloudflare.com → Pages → mealio → Custom domains
2. Add your domain (must already be on Cloudflare DNS)
3. Rebuild and redeploy the client with the new domain as `VITE_API_URL` if you also move the API

---

## What was done to deploy (reference)

1. `client/src/vite-env.d.ts` — added Vite type reference (fixed TS build error)
2. `client/public/_redirects` — added SPA fallback for Cloudflare Pages routing
3. `server/wrangler.toml` — updated `APP_URL` from `localhost:5173` to `https://mealio.pages.dev`
4. Applied production D1 migrations (already done on April 7, confirmed)
5. Set `VAPID_EMAIL` Worker secret
6. Deployed Worker → `mealio-api.simon-hamblin.workers.dev`
7. Built client with `VITE_API_URL` pointing to the Worker
8. Created Pages project `mealio` → deployed to `mealio.pages.dev`
