# Secrets

Contents: [SEC-1 secret keys in what ships](#sec-1-secret-keys-in-what-ships) · [SEC-2 secrets in the repo and its history](#sec-2-secrets-in-the-repo-and-its-history) · [SEC-3 keys that are public by design](#sec-3-keys-that-are-public-by-design) · [SEC-4 public keys without restrictions](#sec-4-public-keys-without-restrictions) · [SEC-5 fallback secrets](#sec-5-fallback-secrets) · [SEC-6 secrets in logs, errors and source maps](#sec-6-secrets-in-logs-errors-and-source-maps) · [SEC-7 secrets the host stores readable](#sec-7-secrets-the-host-stores-readable)

A secret is anything that lets its holder spend money, read data or act as the app: a server API key, a database
password, a signing secret. Once it reaches the browser, a phone, a public repo or that repo's history, it's public.

## SEC-1 Secret keys in what ships

**Applies:** every app.

**Find:**
- Every env var with a client prefix. The prefix (`NEXT_PUBLIC_`, `VITE_`, `EXPO_PUBLIC_`, `REACT_APP_`, `PUBLIC_`,
  `NUXT_PUBLIC_`, `GATSBY_`) copies the value into the bundle at build time, so list every such name and judge each one
  against SEC-3 (a `DATABASE_URL`, `RESEND_API_KEY` or `GROQ_API_KEY` behind one is as bad as a `SECRET`). This prints
  names, not values:
  `grep -rhoE "\b(NEXT_PUBLIC|VITE|EXPO_PUBLIC|REACT_APP|PUBLIC|NUXT_PUBLIC|GATSBY)_[A-Z0-9_]+" --exclude-dir=node_modules . | sort -u`
- Secret formats in the source and in the built output (`.next/static`, `dist`, `build`, `out`, the iOS or Android
  bundle). `-l` lists the files without printing the keys; open each and quote the match masked: `grep -rlE "sk_live_[0-9A-Za-z]{10,}|rk_live_[0-9A-Za-z]{10,}|sk-(proj-|ant-)?[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY" --exclude-dir=node_modules .`
- Supabase's older keys are JWTs. Decode any `eyJ…` string in client code or the bundle (the middle part,
  `cut -d. -f2 | base64 -d`) and look for `"role":"service_role"`. Its newer secret keys (`sb_secret_…`) are refused
  when a browser sends them, which hides the leak in testing, but anyone can use one from any other tool.
- Server code pulled into the client: `"use client"` files that import a module holding secrets or constants, props
  passed from a server component or `getServerSideProps` that carry a key (they land in the page's HTML), and Expo's
  `app.json` or `app.config.*` `extra` fields, which ship inside the app.
- Paid APIs called straight from the browser or the phone: client code calling `api.openai.com`, `api.anthropic.com`,
  `generativelanguage.googleapis.com`, `api.twilio.com`, `api.resend.com`, `api.sendgrid.com`, or `api.stripe.com` with
  a secret key.

**Prove:** the masked key and the built file that holds it (`/_next/static/chunks/app/page-….js`).

**Fix:** call the paid API from a server route that keeps the key in a server-only variable, checks the session and
limits use (references/abuse-and-bills.md). Add `import "server-only"` to modules that read secrets, so importing one
from the client fails the build. Then rotate the key (SKILL.md, Fixing).

**At stake:** anyone with dev tools spends on the owner's account. TechRadar (April 2026): a solo developer's leaked
Google API key ran up $15,400 of Gemini charges before the billing alert arrived.

## SEC-2 Secrets in the repo and its history

**Applies:** every app in git.

**Find:**
- Tracked files that hold secrets: `git ls-files | grep -iE "(^|/)\.env($|\.)|\.pem$|\.p12$|\.key$|service-?account|credentials\.json"`.
  `.env.example` with empty values is fine.
- `.gitignore` without `.env*`.
- The history: `gitleaks git -v --redact` (`gitleaks detect -v --redact` on versions before 8.19). Without gitleaks,
  list the commits that added or removed a pattern, without their diffs (`git log --all --oneline -S "sk_live_"`), and
  env files that were deleted
  (`git log --all --diff-filter=D --name-only -- "*.env*"`).
- Whether the repo is public, or ever was.

**Prove:** the file, the commit and the masked value.

**Fix:** rotate every key found. Deleting the file or rewriting history doesn't take it back: forks, clones and caches
keep it. Add `.env*` to `.gitignore` (keep `.env.example`), and a secret scan before each commit (gitleaks as a
pre-commit hook).

**At stake:** bots scan public GitHub for new keys within minutes of a push.

## SEC-3 Keys that are public by design

**Applies:** whenever SEC-1 or SEC-2 turns up one of these. It belongs in the client, so it isn't a leak; check what
it relies on instead, and report that if it fails.

| Key | Looks like | Safe only while |
| --- | --- | --- |
| Supabase anon or publishable key | a JWT with `"role":"anon"`, or `sb_publishable_…` | row level security and storage policies hold (references/data-access.md, DB-1 to DB-5) |
| Firebase web config | `apiKey: "AIza…"` with `authDomain`, `projectId` | the rules hold (DB-6), App Check is on, and the key is restricted (SEC-4) |
| Stripe publishable key | `pk_live_…` | always: it can only start payments |
| Google Maps or Places key | `AIza…` | it's restricted to your sites or app ids and to the Maps APIs (SEC-4) |
| Analytics and error tracking | Sentry DSN, PostHog `phc_…`, Segment write key, Mixpanel token | always: the worst is junk events |
| Mapbox public token | `pk.…` | always (an `sk.…` token is secret) |
| Algolia search-only key | 32 hex characters, set as search-only | the index holds nothing private |
| Clerk, Auth0, Pusher, RevenueCat public keys | `pk_…`, a client id, an app key, `appl_…`, `goog_…` | the matching secret stays on the server |

Everything else is secret: `sk_…`, `rk_…`, `service_role`, `sb_secret_…`, `AKIA…`, and any key named secret, admin,
private or server.

## SEC-4 Public keys without restrictions

**Applies:** every Google API key in a client (Firebase, Maps, YouTube), and any public key that has restriction
settings.

**Find:** `AIza` keys in the client or the bundle. For each, its restrictions in Google Cloud Console (APIs & Services,
Credentials): an application restriction (websites, iOS bundle id, or Android package and SHA-1) and an API
restriction (only the APIs the client calls). A client key whose API restrictions include the Generative Language
API (Gemini) is a Gemini key in public: SEC-1. Before 19 June 2026, a key with no API restriction could call Gemini in
any project where Gemini was enabled; Gemini now refuses those, but the key still works for every other API enabled
in the project. Without console access, this goes under "Needs checking".

**Fix:** restrict every browser key to its sites or app ids and to the APIs it needs. Keep Gemini in a separate project,
called only from the server with a server key.

**At stake:** a Maps or Firebase key with no API restriction became a Gemini key the day someone enabled Gemini in
its project. Truffle Security found 2,863 such live keys on public web pages (February 2026), and a small tyre shop's
2021 Maps key ran up about $14,000 of Gemini calls in a day (June 2026). Since 19 June 2026 Gemini refuses unrestricted
keys in projects where it's enabled, but a key restricted to Gemini that ships in a client is still SEC-1.

## SEC-5 Fallback secrets

**Applies:** any secret read from the environment with a default.

**Find:** `process.env.X || "…"`, `?? "dev-secret"`, `os.getenv("X", "…")` and hard-coded secrets in config
(`secret: "keyboard cat"`, `jwtSecret: "changeme"`) for session, JWT, cookie, webhook and admin secrets. Also checks
that compare input to a variable that may be unset: `cookie !== process.env.ADMIN_SECRET` lets in anyone who sends no
cookie when the variable is missing, because `undefined === undefined`. And example values that ship as real ones
(`ADMIN_PASSWORD=letmein` in `.env.example`).

**Prove:** it's a finding only if production can run with the fallback. Check that the host sets the variable for
production (`vercel env ls`, which shows names; `netlify env:list --json | jq keys`, names only; the host's dashboard;
"Needs checking" when you can't see it).

**Fix:** fail closed: throw at startup when the variable is missing, and delete the default.

**At stake:** anyone who reads the repo, or guesses "changeme", can sign sessions as any user. A study of 20,656
AI-generated apps (Invicti, November 2025) found the JWT secret `supersecretkey` in 1,182 of them.

## SEC-6 Secrets in logs, errors and source maps

**Applies:** every app.

**Find:** `console.log(process.env`, logging of request headers or bodies (`Authorization`, cookies, card or password
fields), error responses that include stack traces, SQL or env values; production source maps
(`productionBrowserSourceMaps: true` in `next.config`, `build.sourcemap: true` in Vite, `.map` files in the deploy
folder); dotfiles the host serves (with the owner's yes, `curl -sI https://<app>/.env` and `/.git/config`: a 200 with
`text/html` is usually a single-page app's fallback page, not the file; a 200 with any other type is served, and is
a finding without downloading it).

**Fix:** log ids, not secrets or bodies; send clients a generic error and keep the detail in the server log; upload
source maps to the error tracker without serving them; block dotfiles at the host.

**At stake:** keys and internals handed to whoever can trigger an error.

## SEC-7 Secrets the host stores readable

**Applies:** apps whose secrets live in the host's environment variables (Vercel, Netlify, Render, Railway, Fly).

**Find:** whether each secret is stored as write-only (Vercel's Sensitive or Secret type, Netlify's "Contains secret
values") or as plain config anyone on the team, and anyone who gets into the account, can read back (`vercel env ls`
shows the type). Whether production secrets differ from preview and development ones. Usually "Needs checking".

**Fix:** re-save every secret as write-only and rotate it, use separate values for production, and remove team members
who no longer need access.

**At stake:** in Vercel's April 2026 incident, attackers decrypted customers' environment variables that weren't marked
sensitive; the sensitive ones weren't read.
