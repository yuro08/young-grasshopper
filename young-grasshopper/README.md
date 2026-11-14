# Young Grasshopper

A minimal, white-and-sage internal medicine flashcard app. Screenshot or typed notes → editable AI drafts → concept reviews. Original learning material only; no MKSAP scraping or preloaded question-bank content.

## What is included

- Email/password sign-in, sign-up, email confirmation, password recovery, sign-out.
- Supabase Auth and Postgres workspace storage. Every account owns its cards, review schedules, review history, and daily goal.
- Row-level security checks `auth.uid()`; server requests use the signed-in user's JWT, never a service-role key.
- HttpOnly session cookies; tokens are not available to application JavaScript or stored in localStorage. Server-side refresh, same-origin mutation checks.
- Cloud save indicator, per-tab unsynced recovery, optimistic concurrency conflict detection, JSON export/import, explicit import of previous browser cards.
- OpenAI generation of concept cards and reasoning variations from notes or images. Per-account allowance: 20 generation attempts per UTC database day (provider failures consume an attempt).
- Manual card creation, search, editing, pause/delete, review sessions, daily progress, and FSRS-6 spaced repetition with three recall choices.

## Run locally

Node.js 22 or later. Run `npm ci` to install the pinned FSRS dependency before starting or checking the app.

1. Create a Supabase project. In its SQL editor, run `supabase/schema.sql`.
2. In Supabase Authentication, enable email/password, keep email confirmation enabled, set the Site URL to your app origin, and allow `http://localhost:3000/auth-callback.html` as a redirect URL. Configure production SMTP before inviting real users; the default email service is restricted.
3. Copy `.env.example` to `.env`. Fill in the project URL and anon/publishable key. **Do not use a service-role or secret key.** Add an OpenAI API key if AI creation is wanted. `APP_URL` must exactly match the app's origin.
4. Run `node --env-file=.env server.mjs`, then open http://localhost:3000.
5. Run `npm test` and `npm run build` for checks.

Without Supabase configuration the app opens a clearly marked local design preview. This does not create real accounts and does not provide cloud sync. Preview cards remain in the original browser storage so existing work is preserved. AI requires a real signed-in account and server configuration.

## Deploy to Vercel

1. Put the project in your Git repository and import it into Vercel.
2. Select **Other** as framework, build command `npm run build`, output directory `public`. Keep the included `vercel.json`; the `api/` directory runs as Node serverless functions.
3. Set environment variables from `.env.example` in Vercel. Set `APP_URL` to the exact HTTPS production origin, with no trailing slash. Set `NODE_ENV=production` (Vercel normally does this). Redeploy after changes.
4. Update Supabase's Site URL and redirect allowlist with `https://YOUR_DOMAIN/auth-callback.html`. Preview deployments need their own explicitly allowed origin and matching APP_URL; do not broadly wildcard untrusted origins.
5. Create an account, confirm its email, sign in, and add a card. Sign out and verify a second account cannot see it. Verify cross-device sync and password recovery using your actual Supabase project before public launch.

All API keys remain server-side. No external browser SDK is loaded. No payment or subscription integration is included. Supabase's built-in auth rate limits apply; configure CAPTCHA, email delivery, backups, and your desired signup policy in Supabase before a broad public release. The shared AI quota prevents unlimited requests per account; total provider spend still depends on the number of accounts and your OpenAI budget.

## Existing cards and safe synchronization

After signing in, open Settings → **Import browser cards**. This explicitly merges cards and schedules from the previous version on that device, skips duplicates by question/source, and leaves the original browser data intact. Review logs from the old local workspace remain in its exported backup; migration imports cards and schedules only. JSON export is always available.

Account workspace data is loaded from the server; accounts do not share a browser card store. A failed save retains a user-scoped pending copy in sessionStorage for the current tab. A concurrent update from another device stops saving with a conflict warning. Export your local work before choosing Reload cloud version; it intentionally discards pending edits. The export/import workflow merges cards, not review logs. Sign-out is blocked while there are unsynced changes; retry saving or export and reload first. Draft inputs are cleared at sign-out. Avoid shared browser profiles for private learning notes.

## Medical study limitations

AI output is an editable draft, not independent clinical verification. Compare it against permitted learning sources and current clinical references. Do not upload patient identifiers. Screenshots are sent to the AI provider for generation, not stored in the workspace. Cards alternate a core question and a conceptual variation; this is not on-demand generation of a new variant on each review.

## Files

`public/`: buildless UI; `api/`: Vercel handlers; `lib/`: session and workspace helpers; `supabase/schema.sql`: database + RLS + atomic saves + AI allowance; `server.mjs`: local HTTP runner; `tests/`: unit/mocked integration checks. No real credentials are included.

## Verification scope

Automated checks cover FSRS parity with the pinned upstream engine, learning/relearning, overdue reviews, exact preview calculations at a fixed review time, memory serialization, legacy migration, due-card queues, import validation, unauthorized requests, cross-origin mutation rejection, user-scoped database requests, HttpOnly cookie issuance, conflict handling, and authenticated AI generation. These mock provider services; they do not replace a two-account test against your configured Supabase database or a production email-delivery check.

## Retention scheduler

The old interval multipliers have been replaced with **FSRS-6**, provided by the open-source `ts-fsrs@5.4.2` package. Its dependency is pinned in package-lock.json. The browser serves an unchanged, checked-in ESM copy under `public/vendor/`, including its MIT license. The build verifies that this file matches the installed package. No CDN or scheduler network request is used during review.

- Red **Missed** → Anki/FSRS `Again` (grade 1).
- Yellow **Iffy** → `Hard` (grade 2): correct, but difficult or hesitant. Forgotten answers must use Missed.
- Green **Got it** → `Good` (grade 3).
- The Easy button is intentionally omitted. Historical Easy reviews remain supported when seeding memory from earlier backups.
- Desired retention is 90%, with standard FSRS-6 default parameters, a maximum interval of 36,500 days, and fuzz disabled so previews are deterministic. This is a model target, not a guarantee of measured retention.
- New-card steps: 1 minute and 10 minutes. A new Again returns in 1 minute, Hard in 6 minutes, Good in 10 minutes. Completing the steps graduates into an FSRS-calculated review interval. Mature Again returns after the 10-minute relearning step.
- Each card stores its memory stability, difficulty, review state, last review timestamp, scheduled and elapsed days, learning step, repetitions, lapses, and next due timestamp. Each new review records the rating, pre/post memory states, elapsed time, parameters/version, and core/transfer prompt type. These persist in the existing account workspace and JSON exports.
- Button interval previews and committed reviews use the same engine. Due timestamps are measured from the actual rating time. Long delays between reveal and rating can affect the model's elapsed time.
- Due learning cards take priority and remain in the session until they graduate. The session never shows them before they are due; it displays a waiting state and automatically resumes when due. They remain available after reloading or restarting a session.
- Existing due dates and cumulative counters are retained. Available historical rating timestamps seed FSRS memory; if a legacy card has no history, FSRS memory starts fresh on its next review rather than inventing a past history. Migration is idempotent.

This uses the same FSRS-6 model family as supported by Anki, with the settings above. It does not reproduce every Anki deck option, day-boundary behavior, interval fuzz, parameter optimization, or collection synchronization. It does not claim bit-for-bit identity with a user's customized Anki collection. Parameters use the default population model; they are not personally optimized. Concept and transfer prompts share one memory schedule and are recorded separately in the review log for transparency.

References: https://docs.ankiweb.net/deck-options.html and https://github.com/open-spaced-repetition/ts-fsrs/tree/v5.4.2
