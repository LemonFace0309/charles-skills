# Privacy

Contents: [PRIV-1 no privacy policy, or one that doesn't match](#priv-1-no-privacy-policy-or-one-that-doesnt-match) · [PRIV-2 requests to others before consent](#priv-2-requests-to-others-before-consent) · [PRIV-3 selling, sharing and Global Privacy Control](#priv-3-selling-sharing-and-global-privacy-control) · [PRIV-4 deleting an account](#priv-4-deleting-an-account) · [PRIV-5 people asking for their data](#priv-5-people-asking-for-their-data) · [PRIV-6 processors and transfers](#priv-6-processors-and-transfers) · [PRIV-7 collecting and keeping too much](#priv-7-collecting-and-keeping-too-much) · [PRIV-8 if there's a breach](#priv-8-if-theres-a-breach)

Privacy law asks the same three things everywhere: tell people what you collect and who gets it, don't do more than
you said, and let them get out. Which laws apply turns on where the business and its users are, and for some laws on
size, so the code alone rarely settles it. Flag the risk, name the condition, and leave the ruling to the owner
(SKILL.md, Proof).

## PRIV-1 No privacy policy, or one that doesn't match

**Applies:** every app that collects personal data. An email address counts.

**Find:** a privacy page and links to it from the footer, every sign-up screen and the store listings. Then compare
the policy line by line with the map from SKILL.md, step 1, the way you'd check code against a spec: every kind of
data stored (database columns, analytics events, uploads, logs), every service it goes to by name (analytics, error
tracking, session replay, AI providers, email and SMS senders, payments), why, how long it's kept, how to get a copy or
delete it, and how to reach the owner. California's CalOPPA also wants an effective date, how the policy announces
changes, and how the app responds to "do not track" signals; Connecticut, from July 2026, wants it to say whether
personal data trains AI models.

**Fix:** write it from the map, not a template; name every service; link it everywhere; and update it in the same
change that adds a new service or field.

**At stake:** California's CalOPPA requires a posted policy from any app or site that collects personal information
from Californians, at up to $2,500 per violation; California sued Delta in 2012 for that much per download of an app
without one. Apple and Google
reject apps without a policy link. A policy that says something the code doesn't do is a deceptive practice to the FTC.

## PRIV-2 Requests to others before consent

**Applies:** public web pages, since anyone in the EU or UK can open them.

**Find:** third-party requests on page load: Google Fonts from `fonts.googleapis.com` or `fonts.gstatic.com`; analytics
and ad pixels (`gtag(`, `fbq(`, TikTok, LinkedIn, Hotjar, Clarity, PostHog, Mixpanel); embeds (YouTube, Maps, chat
widgets); scripts from public CDNs. `grep -rnE "fonts\.googleapis|gtag\(|fbq\(|connect\.facebook\.net|clarity\.ms|hotjar|analytics\.tiktok" --exclude-dir=node_modules .`
Then the consent banner: do scripts load before the choice, and is "Reject" as easy as "Accept"? `next/font/google`
downloads the font at build time and serves it from the app, so it isn't a finding.

**Fix:** self-host fonts (`next/font`, Fontsource, or the files in `public/`); load analytics and pixels only after
consent; a banner with Accept and Reject side by side and equally visible; Google's Consent Mode for Google tags in the
EEA.

**At stake:** in January 2022 a Munich court (LG München I, 3 O 17493/20) made a website pay a visitor €100 for sending
their IP address to Google through Google Fonts, which set off a wave of demand letters. Regulators fine cookie banners
that make refusing harder than accepting: up to 4% of turnover under GDPR, and in the UK up to £17.5 million or 4%
under PECR. The UK now lets first-party analytics run without consent if people are told and can object; the EU
doesn't.

## PRIV-3 Selling, sharing and Global Privacy Control

**Applies:** apps with ad or retargeting pixels (including server-side ones such as Meta's Conversions API), or that
share data with advertisers or data brokers, once the business is under California's CCPA: revenue over $26,625,000,
or buying, selling or sharing the data of 100,000 or more California consumers or households a year, or half its
revenue from selling or sharing it. A popular free app with ad pixels can get there. Connecticut's law, from July 2026, reaches any business that sells
personal data or handles sensitive data, whatever its size, and Texas requires consent before selling sensitive data
even from small businesses.

**Find:** ad and retargeting pixels; a "Do Not Sell or Share My Personal Information" link; whether the app honours the
Global Privacy Control signal (`navigator.globalPrivacyControl` in the browser, `Sec-GPC: 1` on requests) by turning
those pixels off before they load, and, since January 2026, shows the person that their opt-out was honoured; whether
an opt-out made while signed in follows the account to every device.

**Fix:** honour GPC before any tag loads and say so on the page, add the link when the app sells or shares, apply
opt-outs to the account, or drop the pixels. Honouring GPC is cheap even when the CCPA doesn't apply yet.

**At stake:** $2,663 per violation, or $7,988 when intentional or involving under-16s. Most recent California fines
were for opt-outs that didn't work: Healthline $1.55 million (2025), Disney $2.75 million and Hertz $1.55 million
(2026). General Motors paid $12.75 million (2026) for selling driving and location data.

## PRIV-4 Deleting an account

**Applies:** every app with accounts.

**Find:** a way to delete the account inside the app (Apple requires it for any app that lets people create an account;
Google Play requires it in the app and through a web link); and the code behind it: does it remove the user's rows in
every table, their files in storage, and their records at processors (the Stripe customer, analytics profile, email
lists), or only sign them out or set a flag?

**Fix:** a delete flow with a confirmation that removes or anonymises everything (foreign keys `on delete cascade`, a
storage cleanup, calls to each processor), plus a web form or email for people who can't open the app.

**At stake:** rejection at review, and the right to deletion under GDPR, CCPA and other state laws.

## PRIV-5 People asking for their data

**Applies:** users in the EU or UK, or in California and the other US states with privacy laws, once those laws apply.

**Find:** a contact for privacy requests in the policy, and some way to produce one user's data.

**Fix:** a privacy address someone reads, and a script that exports a user's data. GDPR gives a month to answer; the
CCPA gives 45 days.

**At stake:** complaints to regulators, and fines when requests go unanswered.

## PRIV-6 Processors and transfers

**Applies:** every service that receives users' personal data.

**Find:** from the map, each processor (database host, hosting, email, SMS, analytics, AI providers) and whether its
data processing agreement is accepted (most offer one in their dashboard or terms); for EU users, whether data leaves the
EU and on what basis (the provider's EU–US Data Privacy Framework certification, which the EU's General Court upheld
in September 2025, or standard contractual clauses).
Mostly "Needs checking".

**Fix:** accept each provider's agreement, list processors in the policy, and pick EU regions when most users are there.

**At stake:** GDPR fines, which regulators size to the business and to how many people were affected.

## PRIV-7 Collecting and keeping too much

**Applies:** every app.

**Find:** fields collected and never used (date of birth, full address, gender, government ids); logs and analytics that
keep emails, IPs or full request bodies forever; session replay that records what people type without masking it;
backups and exports that never expire.

**Fix:** stop collecting what isn't used, set retention periods (and delete on schedule), mask inputs in session replay,
and keep ids rather than emails in analytics.

**At stake:** everything kept is something to lose in a breach, and GDPR's minimisation and storage limits.

## PRIV-8 If there's a breach

**Applies:** every app with personal data. Medium at most: it's about readiness.

**Find:** whether the app keeps logs that would show what was accessed and by whom (database and auth logs, how long
the host keeps them), and whether the owner could reach every user by email.

**Fix:** keep access logs long enough to investigate (30 days at least), know who decides, and know the clocks: under
GDPR the regulator must hear within 72 hours, and every US state has its own notice law.

**At stake:** a breach handled late costs more than the breach.
