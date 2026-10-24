# Shared postcard guestbook

Cloudflare Worker + D1, kept separate from Henrik's existing Fala Gringo services. D1 is the source of truth across devices. The public page lists approved cards; new cards are pending until the owner publishes them at `/admin`.

**Status:** Cloudflare D1 `henrik-postcards` is provisioned, its schema is applied, and the Worker code and `DB` binding are deployed. The homepage is published at https://henrikhestnes.com with https://henrik-larsson-hestnes.pages.dev as a preview. `PUBLIC_ORIGINS` contains the apex, `www` and that preview address; local-file submissions remain disabled. The `ADMIN_PASSWORD` secret is configured. Live verification in Safari passed: the API returned the approved list, the hosted form accepted a clearly labelled setup postcard, and a fresh page load kept that pending card out of the public list. One unpublished **Astra — setup check** postcard remains for Henrik to review or delete. The owner page requires sign-in. Live owner sign-in/approval and a physical two-device test were not performed; moderation and persistence are covered by the Worker integration tests.

- API: https://henrik-postcards.henrik-hestnes.workers.dev/api/postcards
- Owner: https://henrik-postcards.henrik-hestnes.workers.dev/admin
- Worker settings: https://dash.cloudflare.com/2d9cd71eed7053be2a3685407e9035a5/workers/services/view/henrik-postcards/production/settings

No paid plan was enabled. Workers and D1 use the account’s free tier; limits apply. The homepage uses free Cloudflare Pages direct upload. The initial deployment was done through the signed-in dashboard because the CLI session was expired and shell networking unavailable. Do not create a second database when continuing setup.

## Redeploy / maintain

From this directory, in a network-enabled terminal:

```sh
npm install
npx wrangler login
```

The existing database ID is already in `wrangler.jsonc`. Do not reuse Fala Gringo’s database or storage namespace. The initial schema was applied through the D1 console; its migration uses `IF NOT EXISTS`, so the first Wrangler migration can safely register it.

```sh
npm run db:migrate
npm run deploy
npx wrangler secret put ADMIN_PASSWORD
```

Choose a strong unique owner password at the interactive prompt and keep it in your password manager. Do not put it in source, the homepage, a URL, or this README. The API deliberately returns 503 until both its database and owner secret are configured.

Wire up the returned Worker URL and the actual homepage origin:

```sh
node connect.mjs https://YOUR-WORKER.workers.dev https://YOUR-HOMEPAGE.example
npm run deploy
```

The connector updates the homepage's API meta tag and native HTML form action, and sets `PUBLIC_ORIGINS` in the Worker configuration. Publish the updated homepage using its chosen host. For multiple legitimate homepage origins, use a comma-separated `PUBLIC_ORIGINS` value.

`ALLOW_FILE_PREVIEW` stays false. Use the hosted Pages preview to submit postcards; a direct-file preview can only read approved notes. GET approved cards is intentionally readable cross-origin; there are no credentials on public requests. An empty API meta tag uses `/api/postcards`, suitable if the homepage is served by the same Worker with an ASSETS binding.

## Owner flow

Visit `https://YOUR-WORKER.workers.dev/admin`, sign in, and choose **Publish postcard** for notes to make public. Published cards can also be deleted. The password never travels to the static homepage; sign-in uses the Worker's origin and a signed, HttpOnly, Secure, SameSite=Strict twelve-hour cookie. Changing the Worker secret invalidates existing sessions.

## Behavior

- Name (60 chars), optional city (80), note (500). Server validates and uses bound SQL parameters. Public and owner UIs insert messages as text, never HTML.
- Shared per-IP hourly submission limits and sign-in limits; only keyed hashes are stored, not raw IPs. Rate-limit records expire. Pending records are never returned by the public API.
- Honeypot, bounded request body and allowed-origin checks. These are basic abuse controls, not a claim of bot-proof protection.
- Retry IDs prevent duplicate cards after a lost response. A normal HTML form also works without JavaScript and redirects to a receipt page.
- No localStorage guestbook, fabricated visitor cards, email service or third-party embed. Public GET responses use no-store so another device can see newly approved notes.

## Tests

```sh
node --test ../tests/postcards.test.mjs
```

Tests execute the actual Worker request handler with Node's SQLite adapter, then close/reopen the database to check durability through a fresh connection. They cover moderation, owner sessions, origin checks, malformed input, parameter binding, retries, rate limits, form submission and unconfigured-service failure. This is not a cloud deployment or a physical two-device test.

After deployment, verify a clearly marked test note is received as pending from one browser, approve it in the owner view, and read it from a separate browser/device. Remove the test note afterward. Keep real visitor data out of source control.
