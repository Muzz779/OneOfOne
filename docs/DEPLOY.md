# Deploying OneOfOne (Supabase + Vercel)

The app runs locally with zero setup using an in-memory + disk mock. To run it
**online properly** you need real persistence, because serverless (Vercel) has an
ephemeral, read-only filesystem — uploads and orders must live in Supabase.

## 1. Create a Supabase project
1. Go to https://supabase.com → **New project**. Pick a region near South Africa
   (e.g. `eu-west` or the closest available). Save the database password.
2. Once it's ready, open **SQL Editor** → paste the contents of
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. This creates the
   tables, the private storage buckets, RLS, the order-number function, and seeds
   the store-owner admin row.
3. Open **Project Settings → API** and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)
4. **Auth → Providers → Email**: for instant sign-in after registration, turn
   **"Confirm email" OFF** (or keep it on and add a confirmation flow later).

## 2. Set environment variables
Copy [`.env.example`](../.env.example) → `.env.local` for local testing, and set
the same keys in **Vercel → Project → Settings → Environment Variables** for
production. Generate strong values:

```bash
# each of these should be a long random string
openssl rand -hex 32   # ONEOFONE_SIGNING_SECRET
openssl rand -hex 32   # ONEOFONE_PAYMENT_WEBHOOK_SECRET
openssl rand -hex 16   # ONEOFONE_SETUP_TOKEN
```

Set `ONEOFONE_ADMIN_PASSWORD` to your chosen admin password (login is
`owner@oneofone.co.za`).

## 3. Deploy to Vercel
1. Push this repo to GitHub.
2. In Vercel → **Add New Project** → import the repo. Framework preset: Next.js.
   Build command and output are auto-detected. Add the env vars from step 2.
3. Deploy. `sharp` works on Vercel's Node runtime out of the box.

## 4. Seed inventory (once)
After the first deploy, run the one-time inventory seed:

```bash
curl -X POST "https://YOUR-DOMAIN/api/setup?token=YOUR_ONEOFONE_SETUP_TOKEN"
```

It's idempotent — it only seeds if inventory is empty.

## 5. Verify
- Visit `/` and `/products` — storefront renders.
- `/studio` — upload an image (stored in the Supabase `originals` bucket).
- Place an order through checkout → the mock payment page → `/orders/<id>` shows
  the production mockups; `/admin` (login) shows the order + downloadable
  production files from the private `production` bucket.
- `/account/register` — creates a real Supabase Auth user; orders you place while
  signed in appear under `/account`.

## Enable real Yoco payments
The app ships with a mock gateway. To take real card payments with Yoco:
1. Sign up at [yoco.com](https://www.yoco.com) and open **Developers** in the
   dashboard. Copy your **secret key** (start with the test key `sk_test_...`).
2. **Register the webhook**: point it at `https://YOUR-DOMAIN/api/payments/webhook`.
   Yoco gives you a **signing secret** (`whsec_...`). You can do this in the
   dashboard, or via the API:
   ```bash
   curl -X POST https://payments.yoco.com/api/webhooks \
     -H "Authorization: Bearer $YOCO_SECRET_KEY" \
     -H "Content-Type: application/json" \
     -d '{"name":"oneofone","url":"https://YOUR-DOMAIN/api/payments/webhook"}'
   # → the response's "secret" (whsec_...) is your YOCO_WEBHOOK_SECRET
   ```
3. In Vercel env vars set `YOCO_SECRET_KEY`, `YOCO_WEBHOOK_SECRET`, and
   `NEXT_PUBLIC_SITE_URL` (your production URL). Redeploy.
4. Checkout now redirects to Yoco's hosted page; on success Yoco calls the
   webhook (signature-verified, idempotent) which marks the order paid and kicks
   off production. Test with a Yoco test card, then switch to live keys.

## Still mock (swap when ready)
Delivery (PUDO) and email/SMS notifications remain behind their service
interfaces with dev mocks. Wire real providers in `src/server/container.ts`; the
rest of the app doesn't change.

## Custom domain & production checklist
- Point your domain at Vercel; set `NEXT_PUBLIC_SUPPORT_WHATSAPP` to your real
  WhatsApp number to switch the support button live.
- Confirm the printer specification in `src/config/printer.ts` with your printer
  (§58) before taking real orders.
