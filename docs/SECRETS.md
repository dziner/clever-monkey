# Secrets & Credentials Rotation Guide

> Use this guide whenever you rotate any API key, OAuth client, or
> Supabase credential. Keep this document up-to-date as new integrations
> are added.

This project uses these external services, each with their own secrets:

| Service | What it does | Where keys live |
|---|---|---|
| **Google Gemini** | AI model calls (summary, chat, quiz, …) | `GEMINI_API_KEYS` (preferred, multi-key, server-only) or `GEMINI_API_KEY` (single, legacy) |
| **Groq** *(optional)* | Fallback / overflow AI provider (OpenAI-wire compatible) | `GROQ_API_KEY` (server-only) |
| **Cerebras** *(optional)* | Extra fallback AI provider (OpenAI-wire compatible) | `CEREBRAS_API_KEY` (server-only) |
| **Supabase** | Auth, database, file storage | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client), `SUPABASE_SERVICE_ROLE_KEY` (server) |
| **Stripe** | Pro subscription checkout, billing portal, webhook sync | `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL` |
| **Google OAuth** | "Continue with Google" sign-in | Configured **inside Supabase**, not in app code |

### Multi-provider AI routing

AI generation is routed per task type by `netlify/functions/lib/router.ts`.
Each task tries an ordered chain of providers and falls back to the next
on a 429 / 503 / 504 / timeout (or unparseable JSON). **Groq and Cerebras
are optional** — if their key is absent, those route steps are skipped and
the task runs Gemini-only. Every route chain ends on a Gemini step, so the
app works with just `GEMINI_API_KEY` set.

- `GROQ_API_KEY` — free tier, ~14.4k req/day on small models. Get it at
  [console.groq.com](https://console.groq.com) → API Keys. No card needed.
- `CEREBRAS_API_KEY` — free tier, Groq-class limits. Get it at
  [cloud.cerebras.ai](https://cloud.cerebras.ai) → API Keys.

Adding either key is **zero-downtime**: set it in Netlify env and redeploy;
routing picks it up automatically. To tune which provider leads each task,
edit the `TASK_ROUTES` table in `netlify/functions/lib/router.ts`.

---

## 0. Know your keys

| Variable | Purpose | Browser-exposed? | Where to get it |
|---|---|---|---|
| `GEMINI_API_KEYS` | Gemini model access — **comma- or newline-separated** list of keys for automatic rotation | **Server-only** | Google AI Studio |
| `GEMINI_API_KEY` | Single Gemini key (legacy / fallback when `GEMINI_API_KEYS` is not set) | **Server-only** | Google AI Studio |
| `SUPABASE_SERVICE_ROLE_KEY` | Full-access Supabase admin | **Server-only** | Supabase dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase public client | OK to expose | Same place — *anon public* key |
| `VITE_SUPABASE_URL` | Supabase project endpoint | OK to expose | Same place — Project URL |
| `STRIPE_SECRET_KEY` | Creates Checkout and Billing Portal sessions | **Server-only** | Stripe dashboard → Developers → API keys |
| `STRIPE_PRO_PRICE_ID` | Recurring Pro subscription price used by Checkout | **Server-only** | Stripe dashboard → Product catalog → Price |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhook signatures | **Server-only** | Stripe dashboard → Webhooks or `stripe listen` |
| `APP_BASE_URL` | Absolute app URL used for Stripe redirects | **Server-only** | Your production origin, e.g. `https://clevermonkey.app` |

### Gemini key rotation pool

The Netlify Function maintains an in-memory pool of Gemini API keys
and automatically rotates to the next healthy key when one returns a
quota / rate-limit / invalid-key error. Configure via **either**:

- `GEMINI_API_KEYS` = comma- or newline-separated keys (recommended)
- `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, … up to `_10`
- `GEMINI_API_KEY` = single key (legacy / fallback only)

Exhausted keys cool down before being retried:
- rate-limit → **1 minute**
- quota exceeded → **1 hour**
- invalid key → **24 hours** (effectively disabled until env is fixed)

Pool state lives per warm Function instance; cold starts reset it.

> ⚠️ The `VITE_` prefix is meaningful. Vite **bakes any `VITE_*`
> variable into the browser bundle at build time**. Never prefix
> `GEMINI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with `VITE_`.

> ℹ️ Rotating Supabase API keys usually rotates **both anon and
> service_role** at once. The Project URL stays the same unless you
> created a new project.

---

## 1. Where to update each secret

### A) Production — **Netlify**

This is the most important target. If this isn't updated and
redeployed, the live site breaks.

- [ ] Netlify dashboard → site → **Site configuration → Environment variables**
- [ ] Update the values:
  - [ ] `GEMINI_API_KEYS` (preferred — comma-separated list) **or** `GEMINI_API_KEY` (single)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_SUPABASE_URL` (usually unchanged — verify)
- [ ] **Redeploy**: Deploys → Trigger deploy → **Clear cache and deploy site**
  - `VITE_*` values are bundled at build time, so a redeploy is
    mandatory. Updating env vars alone leaves the old anon key
    embedded in the previous build.

### B) Local development — `.env.local`

- [ ] Create `.env.local` at the project root (template:
      `.env.local.sample`).
- [ ] Client values (Vite reads these):
  ```
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_ANON_KEY=...
  ```
- [ ] Server values (for `netlify dev` running the Functions locally):
  ```
  # Multi-key pool (preferred — comma or newline separated):
  GEMINI_API_KEYS=AIzaKEY_ONE,AIzaKEY_TWO,AIzaKEY_THREE
  # Or single key (fallback):
  # GEMINI_API_KEY=AIzaKEY_ONE

  SUPABASE_SERVICE_ROLE_KEY=...
  SUPABASE_URL=...

  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_PRO_PRICE_ID=price_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  APP_BASE_URL=http://localhost:8888
  ```
- [ ] `.env.local` is gitignored — never commit it.
- [ ] Restart the dev server (`npm run dev` / `netlify dev`) — env is
      read only at startup.

### C) Cloud agent runtime (Claude Code on the web)

If you run/build the project from a hosted agent environment, that
environment maintains its own secrets store separate from Netlify.

- [ ] In the environment's secrets / environment variables panel,
      update the same four values.

---

## 2. Google OAuth (Google sign-in) rotation

If you delete or rotate the **Google OAuth client** itself, the
"Continue with Google" button breaks with one of these errors:

- `401: deleted_client` — the OAuth client was deleted
- `redirect_uri_mismatch` — redirect URI not registered correctly
- `access_blocked` — OAuth consent screen unconfigured

The client lives **inside Supabase**, not in the app code. To restore
sign-in:

### Step 1 — Google Cloud Console: create a new OAuth client

- [ ] [console.cloud.google.com](https://console.cloud.google.com) → project → **APIs & Services → Credentials**
- [ ] **+ CREATE CREDENTIALS → OAuth client ID**
- [ ] Application type: **Web application**
- [ ] **Authorized JavaScript origins**:
  - [ ] `https://<your-app>.netlify.app` (production)
  - [ ] Custom domain, if any
  - [ ] `http://localhost:5173` (local dev)
- [ ] **Authorized redirect URIs** — this MUST be the Supabase
      callback URL exactly:
  ```
  https://<PROJECT_REF>.supabase.co/auth/v1/callback
  ```
  - `<PROJECT_REF>` = the subdomain part of your `VITE_SUPABASE_URL`.
- [ ] Copy the resulting **Client ID** and **Client Secret**.

> If creating credentials is blocked, the **OAuth consent screen**
> probably got reset too. Configure it first under
> **APIs & Services → OAuth consent screen** (app name, support email,
> authorized domain `supabase.co`).

### Step 2 — Supabase: register the new client

- [ ] Supabase dashboard → project → **Authentication → Sign In / Providers → Google**
- [ ] **Client ID (for OAuth)** = new Client ID from Step 1
- [ ] **Client Secret (for OAuth)** = new Client Secret
- [ ] Google provider toggle: **Enabled**
- [ ] **Save**

### Step 3 — Supabase: redirect allow-list

The app uses `redirectTo: window.location.origin`, so each origin the
app runs on must be allow-listed:

- [ ] Supabase → **Authentication → URL Configuration**
- [ ] **Site URL** = production origin (e.g. `https://<your-app>.netlify.app`)
- [ ] **Redirect URLs** include:
  - [ ] `https://<your-app>.netlify.app/**`
  - [ ] `http://localhost:5173/**`
  - [ ] Custom domain, if any

---

## 3. Verify after rotation

- [ ] `npm run build` succeeds locally
      (`services/supabaseClient.ts` throws at startup if env vars are
      missing — surfaces problems immediately)
- [ ] Sign in with email / password — confirms Supabase anon key works
- [ ] Sign in with Google — confirms the OAuth client + redirect URLs
- [ ] Upload a document and ask a chat question — confirms Gemini key
      and the unauthenticated path
- [ ] Generate a quiz while signed in — confirms `service_role` + the
      `increment_ai_action` RPC are working with the new key

---

## 4. Post-rotation hygiene

- [ ] Confirm the **old Gemini key** is deleted in Google AI Studio
      (not just rotated locally).
- [ ] Confirm the **old Google OAuth client** is deleted in Google
      Cloud Console.
- [ ] Sanity-check that no key was ever committed to git history:
      ```
      git log -p --all | grep -iE "AIza|eyJ|service_role" | head
      ```
      If anything turns up, that key must stay rotated permanently.
- [ ] After Supabase JWT-secret rotation, existing user sessions are
      invalidated — users will be asked to sign in again on next
      visit. This is normal.

---

## Quick reference — what to touch

| Rotation event | Code? | Netlify env? | Local `.env.local`? | Supabase dashboard? | Google Cloud? |
|---|---|---|---|---|---|
| Gemini key rotated | ❌ | ✅ `GEMINI_API_KEYS` (or `GEMINI_API_KEY`) | ✅ same | ❌ | ❌ |
| Adding more Gemini keys (rotation pool) | ❌ | ✅ append to `GEMINI_API_KEYS` | ✅ same | ❌ | ❌ |
| Supabase keys rotated | ❌ | ✅ anon + service_role | ✅ anon + service_role | ❌ | ❌ |
| Supabase project URL changed | ❌ | ✅ `VITE_SUPABASE_URL` + `SUPABASE_URL` | ✅ same | Update Site URL / Redirect URLs | Update Authorized redirect URI to new `<PROJECT_REF>.supabase.co/auth/v1/callback` |
| Stripe key or webhook secret rotated | ❌ | ✅ Stripe server envs | ✅ same | ❌ | ❌ |
| Stripe Pro price changed | ❌ | ✅ `STRIPE_PRO_PRICE_ID` | ✅ same | ❌ | ❌ |
| Google OAuth client rotated | ❌ | ❌ | ❌ | ✅ Providers → Google: Client ID + Secret | ✅ new OAuth client + redirect URI |

**The app code never needs changes for any of these rotations** —
every secret is referenced via environment variables or stored
inside Supabase.
