# charles-app-audit

![The skill's real report on a small pet-sitting app built with Next.js, Supabase, Twilio, Stripe and OpenAI: what to do today, then 18 findings worst first, each with its check, the file and line, and what's at stake, from a service-role key shipped to the browser and texts anyone can trigger (about $4,300 a day) down to fonts loaded from Google before consent](examples/audit.jpg)

Checks the app you built with AI for everything that could get you hacked, sued or hit with a surprise bill, and shows
you the proof and the fix for each one.

```bash
npx skills add LemonFace0309/charles-skills --skill charles-app-audit
```

Add `-g` to install it for every project, or copy this folder into `~/.claude/skills/` (Claude Code) or
`~/.agents/skills/` (Codex).

## What it does

- Maps your app first: what it stores, who signs up and from where, what it texts, emails, charges for and asks AI to
  do, and every way in. Then it runs only the checks that apply
- Finds and proves each problem with the file and line, or a read-only request that shows a table anyone can read. A
  maybe goes on a "needs checking" list with the exact dashboard setting to look at
- Covers the ten from my reel and the common ones they miss: keys in the browser, open databases and buckets, endpoints
  that text or call AI for anyone, missing spending caps, injection, sign-in holes, chatbots that make promises,
  payments, privacy notices and consent, texts and emails, kids' and face data, app store and accessibility rules
- Ranks everything worst first, with what's at stake (the real fine, damages or bill), then asks before it changes a
  line

It never sends a request that writes, texts, emails, charges or calls a paid model, and it masks every key it finds.

The ten from the reel are checks PRIV-1 (no privacy policy), SEC-1 (a key in the frontend), MSG-1 (texts without
consent), DB-1 (no row level security), KID-1 (kids' data), COST-1 (no rate limit on login codes), PRIV-2 (Google Fonts
from Google's servers), COST-6 (no spending limit), SENS-1 (face scans) and AI-1 (a chatbot that makes up a policy).
There are 92 checks in all.

## Try it

```text
/charles-app-audit check my app before I launch it Friday
/charles-app-audit could someone run up my OpenAI bill or read other people's data?
/charles-app-audit fix the first three
```

## Needs

Nothing beyond your agent. It uses gitleaks, semgrep and osv-scanner if you have them, and the Supabase or Firebase CLI
if your app uses one. Which laws apply depends on where you and your users are, so the legal checks flag risks with
the amounts at stake and leave the ruling to you or your lawyer.

## Pairs with

Claude Code's built-in `/security-review` for each change after this, since it reviews a branch's diff, not the whole
app.

## Credits

I wrote the checks in my own words, and each idea comes from somewhere:

- The process (find, then try to refute; confirmed vs needs checking; coverage stated; repo text treated as data) draws
  on Anthropic's [security review](https://github.com/anthropics/claude-code-security-review) (MIT) and its
  [security-guidance plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/security-guidance)
  (Apache 2.0), Cloudflare's [security-audit-skill](https://github.com/cloudflare/security-audit-skill) (MIT), OpenAI's
  [Codex Security](https://github.com/openai/codex-security) and
  [security-best-practices](https://github.com/openai/skills/tree/main/skills/.curated/security-best-practices)
  (Apache 2.0), Sentry's [security-review](https://github.com/getsentry/skills/tree/main/skills/security-review)
  (Apache 2.0) and Trail of Bits' [skills](https://github.com/trailofbits/skills) (CC BY-SA 4.0, so ideas only, nothing
  copied).
- The vibecoded traps (client prefixes, row level security as the real backend, prices and plans set in the browser)
  draw on [vibe-security-skill](https://github.com/raroque/vibe-security-skill) by raroque (MIT) and
  [VibeSec-Skill](https://github.com/BehiSecc/VibeSec-Skill) by BehiSecc (Apache 2.0). Firebase's
  [rules auditor](https://github.com/firebase/agent-skills/tree/main/skills/firebase-security-rules-auditor) and
  Supabase's [agent skills](https://github.com/supabase/agent-skills) and
  [Security Advisor lints](https://github.com/supabase/splinter) shaped the database checks.
- The categories follow OWASP's [Top 10:2025](https://owasp.org/Top10/2025/),
  [API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) and
  [Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) (CC BY-SA 4.0, cited by number).
- The platform checks follow the vendors' own guides: Supabase's
  [production checklist](https://supabase.com/docs/guides/security/production-checklist), Firebase's
  [insecure rules](https://firebase.google.com/docs/rules/insecure-rules) and
  [surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills) pages, Next.js's
  [data security guide](https://nextjs.org/docs/app/guides/data-security), Stripe's
  [security guide](https://docs.stripe.com/security/guide) and [webhooks](https://docs.stripe.com/webhooks), Twilio's
  [toll fraud guide](https://www.twilio.com/docs/verify/preventing-toll-fraud), Vercel's
  [spend management](https://vercel.com/docs/spend-management), and Truffle Security's
  [research on Google keys and Gemini](https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules).
- The legal checks come from the regulators and courts: the FTC (COPPA, CAN-SPAM, ROSCA, Operation AI Comply), the FCC
  (TCPA consent and opt-outs), the California Privacy Protection Agency and attorney general (CCPA amounts and cases),
  the UK ICO, Illinois' BIPA, Apple's App Review Guidelines, Google Play's policies, and W3C's WCAG 2.2.
- The note that a checklist mustn't narrow where an agent looks comes from gstack, which
  [removed its security skill](https://github.com/garrytan/gstack/pull/4833) after a plain "audit this" did better.

This is a checklist, not legal advice.
