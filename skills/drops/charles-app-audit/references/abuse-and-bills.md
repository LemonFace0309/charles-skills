# Abuse and bills

Contents: [COST-1 texts anyone can trigger](#cost-1-texts-anyone-can-trigger) · [COST-2 emails anyone can trigger](#cost-2-emails-anyone-can-trigger) · [COST-3 AI anyone can run](#cost-3-ai-anyone-can-run) · [COST-4 sign-ups and bots](#cost-4-sign-ups-and-bots) · [COST-5 bandwidth, storage and images](#cost-5-bandwidth-storage-and-images) · [COST-6 no spending caps](#cost-6-no-spending-caps) · [COST-7 functions that call themselves](#cost-7-functions-that-call-themselves)

A metered service with nothing in front of it is a bill anyone can run up. A cost finding names three things: the path
from a request to the paid service, the limit that's missing (look first for one at the provider, the gateway, the
queue or the body size), and a worst-case spend a day from the provider's own prices. Never test a limit by sending
traffic.

## COST-1 Texts anyone can trigger

**Applies:** one-time codes, phone sign-in, invites, "text me a link", notifications to numbers users type.

**Find:** every route that sends a text (`messages.create`, `verify.v2.services(…).verifications.create`, Vonage,
MessageBird, Supabase or Firebase phone sign-in). For each: a limit per phone number, per IP and per account; a
CAPTCHA or bot check before sending; a list of the countries it may text; validation of the number.

**Prove:** quote the route and what's missing. Worst case a day: requests a script can send a minute × the price of a
text to the most expensive country allowed × 1,440.

**Fix:** use the provider's verification product instead of sending codes yourself: Twilio Verify has Fraud Guard on by
default, while plain Programmable Messaging needs SMS Pumping Protection turned on (Console, Messaging, Settings).
Limit Geo Permissions to the countries the app serves (Twilio accounts from before 2019 started with every country
on); on Firebase, the SMS region policy and reCAPTCHA SMS defense do the same. Add per-number and per-IP limits (three
codes an hour per number is plenty), a CAPTCHA (Cloudflare Turnstile, hCaptcha; Supabase Auth supports both, and its
own SMS limit lives under Authentication, Rate Limits) and a usage alert. Supabase's spend cap doesn't cover texts: they
go through the app's own Twilio account.

**At stake:** SMS pumping: bots request codes to premium numbers whose owners share the fee. Twitter said it lost $60
million a year to it (Elon Musk, January 2023, reported by Commsrisk).

## COST-2 Emails anyone can trigger

**Applies:** sign-up, magic links, password resets, invites, contact forms and "share by email".

**Find:** the routes that send email (Resend, SendGrid, Postmark, SES, Supabase or Firebase auth emails) and their
limits per address and per IP; forms that let the sender write the subject or body that goes to someone else.

**Fix:** per-address and per-IP limits, a CAPTCHA on public forms, a fixed template for anything sent to an address the
user typed, and no user-written text in invites to strangers.

**At stake:** email bombing a victim through your domain, the provider's bill, and a suspended sending account or a
domain whose real emails now land in spam.

## COST-3 AI anyone can run

**Applies:** every route that calls a model (OpenAI, Anthropic, Gemini, Groq, Replicate, fal, ElevenLabs, a hosted
open model).

**Find:** for each route: a session check; a per-user quota stored on the server (not in a table the client can
write); `max_tokens` or `max_output_tokens`; the model fixed on the server (a client that names the model can pick the
most expensive one); the system prompt built on the server (a route that forwards the client's whole `messages` array
is an open proxy to the model); a cap on input length and file size; and a spend limit at the provider.

**Prove:** quote the route. Worst case a day: requests a minute × (max input tokens × the input price + max output
tokens × the output price) × 1,440. With no `max_tokens`, use the model's largest output.

**Fix:** sign-in required, a daily token budget per user enforced on the server, `max_tokens` set, the model and system
prompt fixed on the server, inputs capped, and a hard monthly limit at the provider (COST-6). A spend alert alone
doesn't stop traffic.

**At stake:** "denial of wallet", OWASP LLM10:2025, Unbounded Consumption: one script keeps the endpoint busy all
night on the owner's card.

## COST-4 Sign-ups and bots

**Applies:** apps with free tiers, trials, credits or anything costly per account.

**Find:** open sign-up with no CAPTCHA; anonymous sign-in (Supabase, Firebase) that gets the same credits as a real
account; free credits granted before the email is verified; one free trial per email rather than per card or phone.

**Fix:** a CAPTCHA on sign-up, credits after verification, trials tied to a payment method, and limits per IP and device.

**At stake:** thousands of fake accounts each spending the free tier on the owner's bill.

## COST-5 Bandwidth, storage and images

**Applies:** apps that serve files, images or video, or accept uploads.

**Find:** large files served from the app host instead of a CDN or object storage; public buckets other sites can
hotlink; Next.js `images.remotePatterns` with a wildcard hostname (`hostname: "**"`) or with protocol, port or pathname
left out (each missing part means "any"), which lets anyone run images from anywhere through your optimizer, plus
`dangerouslyAllowSVG` or `dangerouslyAllowLocalIP`; uploads with no size or count limit (Supabase buckets take
`fileSizeLimit` and `allowedMimeTypes`); no rate limit on downloads.

**Fix:** specific `remotePatterns`, a CDN in front of big files, signed URLs that expire, and upload caps.

**At stake:** a DDoS on a free static site left one developer with a $104,500 Netlify bill (r/webdev, February 2024,
waived after the post spread).

## COST-6 No spending caps

**Applies:** every metered service the map lists. Mostly "Needs checking": the setting lives in a dashboard.

**Find:** for each service, whether a hard cap or at least an alert is set, and where:

| Service | Where | What stops the bill |
| --- | --- | --- |
| Vercel | Settings, Billing, Spend Management (Pro) | A budget only alerts until "Pause production deployments" is on; Hobby stops at its free limits |
| Netlify | Team, Billing (credit-based plans since September 2025) | Projects pause when credits run out, unless a Team Owner turned on auto recharge |
| Supabase | Organization, Billing, Spend Cap (Pro) | Blocks usage past the quota; doesn't cover compute, add-ons or the app's own SMS provider |
| Firebase and Google Cloud | Billing, Budgets & alerts | Budgets alert; spend-cap budgets pause Gemini, Cloud Run, Cloud Functions for Firebase and a few others; API quotas are hard limits |
| Gemini API | AI Studio, Spend | A monthly project spend cap, plus the billing tier's cap |
| OpenAI | Organization and project Limits, Spend | "Enforce a hard limit"; alerts alone don't stop requests |
| Anthropic | Console, Settings, Spend limits | An organization limit and workspace limits stop requests |
| AWS | Billing, Budgets | Alerts; budget actions can restrict, not a hard stop |
| Twilio | Console, usage triggers; Geo Permissions | No hard cap: a trigger can alert or call a webhook that stops sending |

**Fix:** set a cap where one exists and an alert at 50%, 90% and 100% everywhere else; quotas on Google APIs the app
uses; a usage trigger on Twilio that pauses sending.

**At stake:** every other COST check, multiplied by however long it runs before someone looks.

## COST-7 Functions that call themselves

**Applies:** serverless functions, database triggers, webhooks and client data fetching.

**Find:** a Firestore or storage trigger that writes to what triggers it; a webhook handler that causes the event it
handles; retries with no backoff or cap; a `useEffect` that fetches and sets state with missing dependencies (refetches
forever); listeners with no `limit()` on large collections.

**Fix:** a guard that stops the loop (a field marking processed records, idempotency keys), capped retries with
backoff, fixed effects, and limits on queries and listeners.

**At stake:** runaway invocations and reads, billed per call, until someone notices.
