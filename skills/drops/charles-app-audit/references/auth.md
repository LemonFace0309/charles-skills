# Sign-in

Contents: [AUTH-1 tokens the server doesn't verify](#auth-1-tokens-the-server-doesnt-verify) · [AUTH-2 guessable codes and unlimited tries](#auth-2-guessable-codes-and-unlimited-tries) · [AUTH-3 password resets and magic links](#auth-3-password-resets-and-magic-links) · [AUTH-4 redirects after sign-in](#auth-4-redirects-after-sign-in) · [AUTH-5 where the session lives](#auth-5-where-the-session-lives) · [AUTH-6 unverified emails and account linking](#auth-6-unverified-emails-and-account-linking) · [AUTH-7 admin accounts](#auth-7-admin-accounts) · [AUTH-8 messages that confirm an account exists](#auth-8-messages-that-confirm-an-account-exists)

Most vibecoded apps use a provider (Supabase Auth, Firebase Auth, Clerk, Auth.js) and inherit its defaults, which are
good. The holes are where the app adds its own pieces around it: a hand-rolled code, a reset link, a redirect, a role.

## AUTH-1 Tokens the server doesn't verify

**Applies:** any server code that decides who the user is.

**Find:** `jwt.decode(` (reads without checking the signature), `jwt.verify(` without an `algorithms` list, a user id
taken from the body, query or a custom header (`x-user-id`), and on Supabase, `auth.getSession()` used on the server to
trust the user: it reads the cookie without revalidating it, and Supabase's docs say to use `auth.getUser()` (or
`getClaims()`) in server code.

**Fix:** verify on every request with the provider's server SDK (`supabase.auth.getUser()`, Firebase
`verifyIdToken()`, Clerk `auth()`, Auth.js `auth()` or `getServerSession()`), and take the user id only from the
verified result.

**At stake:** anyone sends a token or an id saying they're someone else, and the server believes it.

## AUTH-2 Guessable codes and unlimited tries

**Applies:** one-time codes, PINs, invite codes and password sign-in that the app checks itself, not its provider.

**Find:** codes made with `Math.random()` or a timestamp; codes stored in plain text, never stored (sent but not
checked), or with no expiry; a verify route with no attempt limit (a six-digit code falls to 1,000,000 tries); a
password route with no limit per account or per IP.

**Fix:** `crypto.randomInt(0, 1_000_000)` padded to six digits, stored hashed with a 10-minute expiry, five wrong tries
then a new code, and limits per account and per IP (references/abuse-and-bills.md, COST-1). Prefer the provider's own
OTP, which does this already.

**At stake:** account takeover by brute force. Guessing a login code is on every "how vibecoded apps get hacked" list.

## AUTH-3 Password resets and magic links

**Applies:** any reset, magic-link or invite flow the app builds itself.

**Find:** reset tokens from `Math.random()` or `Date.now()`, tokens that never expire or work twice, compared with `==`
instead of a constant-time compare, and links built from the request (`req.headers.host`, `x-forwarded-host`,
`new URL(req.url).origin`), which lets an attacker send a victim a reset email whose link points at the attacker's site.

**Fix:** 32 random bytes (`crypto.randomBytes(32)`), stored hashed, single use, expiring within an hour; build links from
a configured base URL (`APP_URL`), never from request headers.

**At stake:** account takeover through the reset flow.

## AUTH-4 Redirects after sign-in

**Applies:** OAuth sign-in, magic links and any `?next=`, `?redirectTo=` or `?returnUrl=` parameter.

**Find:** a redirect target taken from the query without checking it (`redirect(searchParams.get("next"))`); provider
allow-lists with wide wildcards (Supabase Auth, URL Configuration, "Redirect URLs" such as `https://*.vercel.app/**`,
which lets any Vercel site receive your users' sign-in tokens; Firebase "Authorized domains" listing domains you don't
control).

**Fix:** accept only relative paths that start with `/` and not `//`; list exact production URLs in the provider, and
preview URLs only under your own team's pattern.

**At stake:** a sign-in link that hands the user's session to someone else's site.

## AUTH-5 Where the session lives

**Applies:** apps that set their own session cookies or store tokens in the browser.

**Find:** session cookies without `HttpOnly`, `Secure` and `SameSite=Lax` (or `Strict`); access or refresh tokens in
`localStorage` next to any XSS sink (references/injection.md, INJ-2); sessions that survive a password change or
"sign out everywhere".

**Fix:** HttpOnly, Secure, SameSite cookies; refresh tokens revoked on password change and sign-out.

**At stake:** one XSS bug becomes stolen accounts.

## AUTH-6 Unverified emails and account linking

**Applies:** email sign-up, and apps that link OAuth accounts to existing ones by email.

**Find:** email confirmation turned off (Supabase: Authentication, Sign In / Providers, "Confirm email"); app code that
treats an unconfirmed user as verified; linking a Google or GitHub sign-in to an existing account because the emails
match, without checking that both are verified.

**Fix:** require confirmation before the account can do anything that matters; link accounts only on verified emails.

**At stake:** someone signs up with your customer's email first and is waiting inside the account when they arrive.

## AUTH-7 Admin accounts

**Applies:** any admin, staff or moderator role.

**Find:** admin decided by an email check in the client, a flag users can write (references/data-access.md, DB-3), a
shared admin password in an env var compared in code, seeded default credentials (`admin@`/`password` in seed files),
and admin access without a second factor.

Then the owner's own accounts, which hold every key: GitHub, the host (Vercel, Netlify), the database (Supabase,
Firebase), Stripe, the AI providers and the domain registrar. Each needs MFA and a second owner, or one phished
password is the whole company. This is "Needs checking".

**Fix:** roles set only by the server, a check on every admin route (references/data-access.md, API-3), named admin
accounts with MFA, no default credentials anywhere in the repo, and MFA with two owners on every platform account.

**At stake:** one admin login is every user's data. In April 2026 a compromised AI tool used by one Vercel employee led
to their Google Workspace and Vercel accounts, and from there to customers' environment variables.

## AUTH-8 Messages that confirm an account exists

**Applies:** sign-in, sign-up and reset screens.

**Find:** different messages or status codes for "no such account" and "wrong password", or "this email is already
registered" on sign-up.

**Fix:** one message for both ("Email or password is incorrect"; "If an account exists, we've sent a link"). Low
severity on its own; rate it higher when the app's user list is itself sensitive (health, dating, debt).

**At stake:** a list of who uses the app, and targets for password guessing.
