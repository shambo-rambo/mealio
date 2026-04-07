# Mealio Setup Guide

Complete these steps in order. Each one tells you exactly what to do.

---

## Step 1 — Anthropic API Key (you already have this)

Your key is already in `.env`. Nothing to do here.

---

## Step 2 — Generate VAPID keys (push notifications)

Run this in your terminal:
```bash
npm run vapid:generate
```

It prints two keys. Copy them — you'll need them in Steps 3 and 4.

---

## Step 3 — Your `.env` file (local dev only)

Open `.env` at the project root and make sure it looks like this.
Replace the placeholder values with your real ones:

```
ANTHROPIC_API_KEY=sk-ant-...          ← already there
JWT_SECRET=pick-any-long-random-string
VAPID_PUBLIC_KEY=                     ← paste publicKey from Step 2
VAPID_PRIVATE_KEY=                    ← paste privateKey from Step 2
APP_URL=http://localhost:5173
```

---

## Step 4 — Cloudflare secrets (production)

You need to be logged in to Cloudflare from your terminal first:
```bash
npx wrangler login
```
This opens a browser tab — just click Authorize.

Then run each of these and paste the value when it asks:

```bash
# Paste your Anthropic key (same as .env)
npx wrangler secret put ANTHROPIC_API_KEY

# Paste the same random string you used in .env
npx wrangler secret put JWT_SECRET

# Paste publicKey from Step 2
npx wrangler secret put VAPID_PUBLIC_KEY

# Paste privateKey from Step 2
npx wrangler secret put VAPID_PRIVATE_KEY
```

---

## Step 5 — Push the database schema to Cloudflare

```bash
npm run db:migrate:prod --workspace=server
```

---

## Step 6 — Deploy the API (Worker)

```bash
npm run deploy --workspace=server
```

When it finishes it prints a URL like:
`https://mealio-api.YOUR-NAME.workers.dev`

Copy that URL — you need it in Step 7.

Then set it as a secret so share links work correctly:
```bash
npx wrangler secret put APP_URL
# paste: https://mealio-api.YOUR-NAME.workers.dev
```

---

## Step 7 — Deploy the frontend (Cloudflare Pages)

**Do this on the Cloudflare website:**

1. Go to https://dash.cloudflare.com
2. Click **Workers & Pages** in the left sidebar
3. Click **Create** → **Pages** → **Connect to Git**
4. Connect your GitHub account and select the `mealio` repo
5. Set these build settings:
   - **Build command:** `npm run build --workspace=client`
   - **Build output directory:** `client/dist`
6. Add this environment variable (click "Add variable"):
   - Name: `VITE_API_URL`
   - Value: the Worker URL from Step 6 (e.g. `https://mealio-api.YOUR-NAME.workers.dev`)
7. Click **Save and Deploy**

When the build finishes, Cloudflare gives you a URL like `mealio.pages.dev` — that's your live app.

---

## Step 8 — Local dev

```bash
npm run dev
```

Frontend runs at http://localhost:5173, API at http://localhost:8787.

---

## Custom domain (optional)

If you want `app.yourdomain.com` instead of `mealio.pages.dev`:

1. In the Cloudflare dashboard, go to your Pages project
2. Click **Custom domains** → **Set up a custom domain**
3. Follow the prompts — DNS and SSL are handled automatically

---

## Summary of what you need to provide

| What | Where to put it |
|------|----------------|
| Anthropic API key | `.env` + `wrangler secret put` |
| JWT secret (make one up) | `.env` + `wrangler secret put` |
| VAPID public key (from Step 2) | `.env` + `wrangler secret put` |
| VAPID private key (from Step 2) | `.env` + `wrangler secret put` |
| Worker URL (from Step 6) | `wrangler secret put APP_URL` + Pages env var |
