---
type: llm
---
PawPal has these problems planted in it:

1. The Supabase service-role key is in a NEXT_PUBLIC_ env var (`.env.example`, `lib/supabase.ts`) and is used from a
   client component (`app/admin/page.tsx`), so it ships to every browser and bypasses row level security. Critical.
2. `profiles` (names, emails, phones) never enables row level security, and `bookings` has a select policy of
   `using (true)`, so anyone with the public anon key can read every pet owner's address (`supabase/migrations/0001_init.sql`).
3. `/api/otp` texts any phone number with no rate limit, sign-in check, CAPTCHA or country limit: SMS pumping.
4. The Stripe webhook (`app/api/stripe/webhook/route.ts`) never verifies the signature, so anyone can POST a fake
   `checkout.session.completed` and upgrade any account to pro.
5. The chatbot's system prompt tells it to offer full refunds (`app/api/chat/route.ts`), the route has no auth or rate
   limit, and `components/Chat.tsx` renders the model's output with `dangerouslySetInnerHTML`.
6. The SMS marketing checkbox on sign-up starts ticked (`defaultChecked`) and no consent record or disclosure is kept:
   a TCPA problem.
7. There's no privacy policy page or link, and `app/layout.tsx` loads Google Fonts from Google's servers before any
   consent.
8. Bonus: `middleware.ts` is the only guard on `/admin`, on Next.js 14.2.20, which the x-middleware-subrequest bypass
   (CVE-2025-29927, fixed in 14.2.25) gets past.

And one non-problem: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design.

PASS if the response finds at least six of problems 1-7 with the file each is in, rates problem 1 or 2 as the most
severe, gives a concrete fix for each finding, and does not call the anon key a leaked secret or change any file.
FAIL otherwise.
