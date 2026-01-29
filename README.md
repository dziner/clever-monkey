# Clever Monkey

## Run locally

Prereqs: Node.js

```bash
npm install
npm run dev
```

### Environment variables

Client-side env vars (bundled by Vite) **must** be prefixed with `VITE_`.

Create a `.env.local` (not committed) using `.env.local.sample` as a starting point:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

#### Gemini API key (server-side)

Gemini calls are proxied through a Netlify Function so the API key never ships to the browser.

Set this in your Netlify site settings (or via Netlify CLI env):

- `GEMINI_API_KEY`

> Note: if you want Gemini features locally, run via Netlify dev (so functions work):
>
> ```bash
> # requires netlify-cli
> netlify dev
> ```

## Deploy (Netlify)

This repo includes `netlify.toml` for stable deploy previews:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

API endpoints are available under `/api/*` and route to the matching Netlify Function.
