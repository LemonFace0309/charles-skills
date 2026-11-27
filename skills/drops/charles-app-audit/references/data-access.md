# Data access

Contents: [DB-1 row level security off](#db-1-row-level-security-off) · [DB-2 policies that let everyone in](#db-2-policies-that-let-everyone-in) · [DB-3 columns users shouldn't change](#db-3-columns-users-shouldnt-change) · [DB-4 views and functions that skip the rules](#db-4-views-and-functions-that-skip-the-rules) · [DB-5 public storage](#db-5-public-storage) · [DB-6 Firebase rules](#db-6-firebase-rules) · [DB-7 realtime that broadcasts rows](#db-7-realtime-that-broadcasts-rows) · [API-1 one user can reach another's records](#api-1-one-user-can-reach-anothers-records) · [API-2 fields the client shouldn't set](#api-2-fields-the-client-shouldnt-set) · [API-3 routes with no auth check](#api-3-routes-with-no-auth-check) · [API-4 checks that only run in the browser](#api-4-checks-that-only-run-in-the-browser)

When the browser or phone talks to the database directly, the database's rules are the only thing between a stranger
and every row: the public key is in the bundle, and anyone can call the API with it. When the app has its own server,
every route, server action and function has to check who's asking and whether they may touch that record.

## DB-1 Row level security off

**Applies:** Supabase, or any Postgres the client reaches through its REST or GraphQL API.

**Find:** every `create table` in `supabase/migrations/*.sql` (or a schema dump) in a schema the API exposes (`public`
unless `supabase/config.toml` lists others) needs `alter table <name> enable row level security`. With database access:
`select schemaname, tablename from pg_tables where schemaname = 'public' and not rowsecurity;`. Supabase's Security
Advisor reports the same as `rls_disabled_in_public`: run `supabase db advisors --linked` when the CLI is linked, or ask the
owner for the list on the dashboard's Advisors page. Its other security lints map to the checks below. Since 2026,
Supabase no longer exposes new tables in `public` to the API until they're granted (every project from 30 October
2026), but older tables keep their grants, so check which tables `anon` and `authenticated` can reach as well:
`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated');`

**Prove** (owner's yes, read-only, no rows shown):
`curl -sI "$SUPABASE_URL/rest/v1/<table>?select=*" -H "apikey: $PUBLIC_KEY" -H "Prefer: count=exact"`. A
`Content-Range` ending in a number above 0 (`0-24/1830`) means anyone can read that many rows.

**Fix:** enable it, then add one policy per action the app needs, scoped to the owner:

```sql
alter table invoices enable row level security;
create policy "read own" on invoices for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own" on invoices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "edit own" on invoices for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

Then sign in as two test users and run the app's flows (SKILL.md, Fixing).

**At stake:** every row in the table, read or rewritten by anyone. Moltbook, a social network built entirely with AI
(February 2026), had a Supabase key in its JavaScript and no row level security: about 1.5 million API tokens and
35,000 emails were readable. A scan of Lovable apps in 2025 (CVE-2025-48757) found 170 of 1,645 exposed this way.
If the business is under the CCPA (references/privacy.md, PRIV-3), California lets each consumer claim $107 to $799 per
incident after a breach of certain unencrypted data: a name with a Social Security, driver's licence or card number,
medical, health insurance or biometric data, or an email with its password (Civil Code 1798.150, amounts adjusted by the
California Privacy Protection Agency in December 2024).

## DB-2 Policies that let everyone in

**Applies:** Supabase with row level security on.

**Find:** in the migrations or `select * from pg_policies where schemaname = 'public';`:
- `using (true)` or `with check (true)` on a table holding anything personal (`grep -rniE "using \(true\)|with check \(true\)" supabase/`,
  case-insensitive because dumps write `USING (true)`; the advisor's `rls_policy_always_true`). Public-by-design tables (a product catalogue) are fine; say so
  in "Checked and fine".
- `to authenticated` with nothing else. Anyone can sign up, so "signed in" isn't a trust boundary, and with anonymous
  sign-ins on (Supabase's `is_anonymous` claim) a "continue as guest" button is enough.
- Policies `to anon` on anything but public content.
- An `update` policy whose `with check` is looser than its `using` (`with check (true)`), so a user can move a row to
  someone else's id. A policy with no `with check` is fine: Postgres reuses `using` for it.
- Policies that read `auth.jwt() -> 'user_metadata'` (or `raw_user_meta_data`) for roles or tenant ids. Users can
  write their own user metadata, so they can make themselves admin (`rls_references_user_metadata`).
- `enable row level security` with no policies at all is closed (safe), but the app's own queries return nothing; the
  owner may "fix" it with `using (true)`. Note it as fine.

**Prove:** quote the policy. For a `using (true)` read, the DB-1 count probe shows how many rows are open.

**Fix:** replace `true` with an ownership or membership test (`(select auth.uid()) = user_id`, or
`team_id in (select team_id from members where user_id = (select auth.uid()))`; in an `exists`, qualify the outer
column, `m.team_id = documents.team_id`, or the bare name binds to `members` and matches every row), tighten the loose
`with check`, and keep roles in `app_metadata` (set only by the server) or a `roles` table users can't write.

**At stake:** the same as DB-1, for every row the policy opens.

## DB-3 Columns users shouldn't change

**Applies:** any table the client can update directly (an "edit own row" policy, or Firebase rules allowing writes to
the user's own document) that also holds a plan, role, credits, balance, `is_admin`, verified flag or price.

**Find:** list the columns of each table with an update policy or client write, then search the client for writes to it
(`.update(`, `.upsert(`, `setDoc(`, `updateDoc(`). Any sensitive column on a self-updatable row is a finding, even if
the UI never sends it: the user can send it with the public key.

**Prove:** quote the policy and the column. Don't write to prove it.

**Fix:** move those columns to a table only the server writes, or limit the grant to the columns users may change.
Postgres can't revoke one column from a table-wide grant (`revoke update (plan) …` does nothing while `update` on the
table stands), so replace the grant:
`revoke insert, update on profiles from anon, authenticated; grant insert (id, full_name, phone), update (full_name, phone) on profiles to authenticated;`.
A `before update` trigger that rejects changes to those columns works too. In Firebase, use
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` to allow-list fields.

**At stake:** free paid plans, unlimited credits, or an admin account for anyone who opens dev tools.

## DB-4 Views and functions that skip the rules

**Applies:** Supabase or Postgres with views or functions in an exposed schema.

**Find:** `grep -rniE "create.*view|security definer" supabase/`.
- A view without `with (security_invoker = true)` runs as its owner and ignores row level security on the tables it
  reads (Postgres 15 and later support the option; the advisor flags "security definer view").
- A `security definer` function in `public` can be called by anyone through `/rest/v1/rpc/<name>`, with its owner's
  rights, unless `execute` is revoked from `anon` and `authenticated`.
- A view or function exposing `auth.users` (emails, phones of every account).
- The advisor's names for these: `security_definer_view`, `anon_security_definer_function_executable`,
  `function_search_path_mutable`, `auth_users_exposed`, `sensitive_columns_exposed`.

**Prove:** quote the definition and the grant.

**Fix:** `alter view <v> set (security_invoker = true);` For functions: make them `security invoker`, or move them to a
schema the API doesn't expose, or `revoke execute on function <f> from public, anon, authenticated;` (functions are
executable by `public` by default, so revoking only the two roles leaves it callable) and check the caller
inside it. Give every `security definer` function `set search_path = ''`.

**At stake:** the same as DB-1, through a side door that the table's policies don't cover.

## DB-5 Public storage

**Applies:** Supabase Storage, Firebase Storage, S3, R2 or any bucket holding uploads.

**Find:** Supabase buckets created with `public: true` (`grep -rnE "public: true|createBucket" --exclude-dir=node_modules .` and
`supabase/config.toml`), policies on `storage.objects` that allow `select` to `anon` or to every signed-in user, and
`getPublicUrl(` used for private files (IDs, receipts, selfies, documents); the advisor's
`public_bucket_allows_listing`. Firebase: `storage.rules` with
`allow read: if true` or `if request.auth != null`. S3/R2: a bucket policy with `"Principal": "*"` or public access
left unblocked.

**Prove:** a file URL that answers 200 to `curl -sI` with no session (headers only, nothing downloaded), or a list call
with the public key that returns another user's file name (`POST /storage/v1/object/list/<bucket>` with
`{"prefix":"","limit":1}`).

**Fix:** private buckets; signed URLs with short expiry (`createSignedUrl(path, 60)`); policies scoped to the owner's
folder, such as `bucket_id = 'docs' and (storage.foldername(name))[1] = (select auth.uid())::text`.

**At stake:** every uploaded file. The Tea dating-safety app (July 2025) left a Firebase storage bucket open and lost
about 72,000 images, including 13,000 selfies and photo IDs, then faced class actions.

## DB-6 Firebase rules

**Applies:** Firestore, the Realtime Database or Firebase Storage used from the client.

**Find:** `firestore.rules`, `database.rules.json`, `storage.rules`, and `firebase.json` for which files deploy.
Findings: `allow read, write: if true;`, `".read": true`, test-mode rules (`if request.time < timestamp.date(...)`),
and `if request.auth != null` alone, which lets any signed-in user (anyone can sign up, often anonymously) read
everything. Rules that check ownership on read but not on create or update, or that validate a document on create
but not on update (create a valid one, then update it into anything). Authority taken from the incoming document
(`request.resource.data.role`, `.isAdmin`, `.ownerId`), which the client wrote. No size limits on Storage uploads. No
App Check enforcement.

**Prove** (owner's yes, read-only, counts and keys only): Firestore, a count with no token,
`curl -s -X POST "https://firestore.googleapis.com/v1/projects/<project>/databases/(default)/documents:runAggregationQuery" -d '{"structuredAggregationQuery":{"structuredQuery":{"from":[{"collectionId":"<collection>"}]},"aggregations":[{"alias":"n","count":{}}]}}'`;
Realtime Database, the top-level keys only, at `https://<db>.firebaseio.com/.json?shallow=true` or, outside
us-central1, `https://<db>.<region>.firebasedatabase.app/.json?shallow=true`. A count or keys back with no token
means open.

**Fix:** ownership on every operation (`allow read, delete: if request.auth.uid == resource.data.ownerId;`
`allow create: if request.auth.uid == request.resource.data.ownerId;`
`allow update: if request.auth.uid == resource.data.ownerId && request.resource.data.ownerId == resource.data.ownerId;`,
so an owner can't hand a document to someone else), field allow-lists on writes (DB-3), deny by
default at the root, and App Check enforced for Firestore, Storage and the Realtime Database.

**At stake:** the whole database, as in DB-1. Chat & Ask AI (January 2026) left a Firebase backend open and exposed
about 300 million messages from more than 25 million users.

## DB-7 Realtime that broadcasts rows

**Applies:** Supabase Realtime (Postgres Changes) or Firestore listeners on tables that hold anything private.

**Find:** tables in the `supabase_realtime` publication (`alter publication supabase_realtime add table`, or the
dashboard's Replication page) and the client subscriptions (`.channel(`, `postgres_changes`, `onSnapshot(`). Postgres
Changes apply row level security to inserts and updates but not to deletes, and a subscription without a filter
listens to the whole table.

**Fix:** keep private tables out of the publication, or send changes through Broadcast with Realtime Authorization;
filter each subscription to the user's own rows; in Firestore, the rules in DB-6 cover listeners too.

**At stake:** other users' changes, live, to anyone who subscribes.

## API-1 One user can reach another's records

**Applies:** any route, server action, function or resolver that takes an id (URL, query, body).

**Find:** handlers that load or change a record by an id from the request with no owner filter:
`findUnique({ where: { id } })`, `.eq("id", params.id)` on a service-key client, `doc(db, "orders", id)` in an admin SDK,
`/api/orders/[id]`. Trace each to see whether the session user is compared to the record's owner or team.

**Prove:** quote the handler and the missing comparison. Don't request another user's record.

**Fix:** filter by the session user in the query (`where: { id, userId: session.user.id }`), or query with the user's own
token so row level security applies, and return 404 for records that aren't theirs.

**At stake:** OWASP's top API risk (API1:2023, broken object level authorization): any user reads or edits any other's
data by changing a number.

## API-2 Fields the client shouldn't set

**Applies:** any handler that writes request data to the database.

**Find:** the body spread into a write: `create({ data: req.body })`, `update(body)`, `.upsert({ ...body })`,
`Object.assign(user, req.body)`, `setDoc(ref, data)`. Then check whether the model has `role`, `plan`, `credits`,
`isAdmin`, `userId`, `price` or `verified`.

**Fix:** parse the body with a schema that lists the fields a user may set (zod, valibot), set owner ids from the
session, and set prices and plans only from the server (references/payments.md).

**At stake:** OWASP API3:2023 (broken object property level authorization): a user makes themselves an admin or a payer.

## API-3 Routes with no auth check

**Applies:** every server route, server action, edge function, cron and admin page.

**Find:** list them (`app/**/route.ts`, `pages/api/**`, files with `"use server"`, `supabase/functions/*`,
`functions/` for Firebase, `api/` for Vercel or Netlify) and check each for a session check on the server
(`auth()`, `getServerSession`, `supabase.auth.getUser()` or `getClaims()`, `verifyIdToken`) before it reads or writes.
- Next.js server actions are public POST endpoints, reachable even when nothing imports them, and a page's auth check
  doesn't cover the actions defined in it, so each action checks the user itself.
- Supabase Edge Functions with `verify_jwt = false` in `supabase/config.toml`, and functions that rely on `verify_jwt`
  alone: it doesn't identify a caller who sends only an API key. Firebase `onRequest` functions have no auth at all
  unless the code checks a token.
- Middleware or guards that fail open: a `try` around the auth check whose `catch` lets the request through.
- Admin pages guarded only by a hidden link, a client-side redirect or `middleware.ts`. On self-hosted Next.js before
  12.3.5, 13.5.9, 14.2.25 and 15.2.3, a request with an `x-middleware-subrequest` header skips middleware entirely
  (CVE-2025-29927; Vercel-hosted apps weren't affected).

**Fix:** check the session in the handler or the server component itself, and the role for admin routes. Cron and
webhook routes check a secret or signature instead (`Authorization: Bearer $CRON_SECRET`; references/payments.md).
Upgrade Next.js past the versions above.

**At stake:** whatever the route does, for anyone who finds its URL in the bundle.

## API-4 Checks that only run in the browser

**Applies:** paid features, limits, roles and prices.

**Find:** gates in client components (`if (user.plan === "pro")`, `isAdmin` from `localStorage` or a client-set cookie,
a usage counter kept in state, a price computed in the browser) whose server route doesn't repeat the check.

**Fix:** enforce it where the work happens: the route, the database policy or the function. The browser check stays
only to hide the button.

**At stake:** paid features for free, and limits that only stop honest users.
