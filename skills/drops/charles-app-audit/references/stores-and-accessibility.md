# App stores, accessibility and user content

Contents: [STORE-1 privacy labels that don't match](#store-1-privacy-labels-that-dont-match) · [STORE-2 no way to delete the account](#store-2-no-way-to-delete-the-account) · [STORE-3 social sign-in without an equivalent](#store-3-social-sign-in-without-an-equivalent) · [STORE-4 user content with no report or block](#store-4-user-content-with-no-report-or-block) · [STORE-5 tracking and privacy manifests](#store-5-tracking-and-privacy-manifests) · [STORE-6 Google Play's technical rules](#store-6-google-plays-technical-rules) · [A11Y-1 screens people can't use](#a11y-1-screens-people-cant-use) · [UGC-1 takedowns and illegal content](#ugc-1-takedowns-and-illegal-content)

The stores enforce their rules at review and after launch; accessibility is enforced by lawsuits in the US and by
regulators in the EU. Payments in apps are in references/payments.md, PAY-8.

## STORE-1 Privacy labels that don't match

**Applies:** iOS and Android apps.

**Find:** the App Store privacy details and the Google Play Data safety form (ask the owner for both; "Needs checking"
otherwise), compared with the map: every data type the app and each SDK collects (analytics, crash reporting,
attribution, ads, session replay), whether it's linked to the user, and whether it's used for tracking. The privacy
policy URL in both listings and inside the app (references/privacy.md, PRIV-1).

Apple also wants apps to say clearly when personal data goes to a third party, AI providers included, and to ask
before sharing it (guideline 5.1.2(i), November 2025): a chat or photo feature that sends data to an AI model needs that
notice and permission in the app.

**Fix:** update both forms from the map and the SDKs' own disclosures, keep them updated with each new SDK, and add a
permission step before the first send to an AI provider.

**At stake:** rejection, or removal after launch when a label is found to be wrong. Apple rejected 2,093,244 of
9,100,620 submissions in 2025, more than 443,000 of them for privacy.

## STORE-2 No way to delete the account

**Applies:** any store app that lets people create an account.

**Find:** an in-app path to delete the account (Apple: a guideline since 2022; a link to email support isn't enough),
and for Google Play, also a web page where people can ask for deletion without the app. What deletion does is
references/privacy.md, PRIV-4.

**Fix:** a "Delete account" button in settings, a confirmation, and the web form or link for Google Play's listing.

**At stake:** rejection at review.

## STORE-3 Social sign-in without an equivalent

**Applies:** iOS apps that offer Google, Facebook or another third-party sign-in.

**Find:** the sign-in screen. Apple's guideline 4.8 requires another login option with equal privacy features (limited
to name and email, the email can be hidden, no tracking without consent); Sign in with Apple meets it. Apps that use
only their own accounts, or sign in to a specific company's or school's system, are exempt.

**Fix:** add Sign in with Apple next to the other providers.

**At stake:** rejection at review.

## STORE-4 User content with no report or block

**Applies:** apps where people post, message, upload or generate content (AI output included) that others see.

**Find:** a way to report content and users, to block users, a filter for objectionable material, and published contact
details (Apple guideline 1.2, which since 2026 also covers random chat; Google Play's user-generated content and
AI-generated content policies, which also want in-app reporting of offensive AI output). Google Play's Child Safety
Standards add a public standards page and a named contact for social, dating and chat apps. Apple now rates dating and
AI-companion apps with romantic or sexual content 18+, and every app must answer the new age questions by 12 January
2027.

**Fix:** report and block on every piece of content and every profile, a review queue someone works, and a contact
address in the app.

**At stake:** rejection or removal, and liability for content the owner was told about and left up.

## STORE-5 Tracking and privacy manifests

**Applies:** iOS apps.

**Find:** `PrivacyInfo.xcprivacy` in the app, and for the SDKs Apple lists as commonly used; reasons declared for
"required reason" APIs (user defaults, file timestamps, disk space, boot time); the App Tracking Transparency prompt
before any tracking with the advertising id, and nothing tracked when people decline; fingerprinting is banned even
with permission.

**Fix:** add the manifest and reasons (Expo and React Native generate them from config), update SDKs to versions that
ship their own manifests, and gate tracking on the ATT answer.

**At stake:** upload rejection; removal for tracking without permission.

## STORE-6 Google Play's technical rules

**Applies:** Android apps.

**Find:** `targetSdkVersion` in the build config against Google Play's current requirement (API 36 for new apps and
updates since 31 August 2026; it rises every August, and an old Expo or React Native template is often behind); the
developer account's verification status (Android developer verification started in four countries in September 2026
and goes worldwide from January 2027); permissions requested and their declarations (background location, SMS, call
log, all-files access need approval).

**Fix:** raise the target SDK before the deadline, complete verification, and drop permissions the app doesn't need.

**At stake:** updates blocked or the app hidden from new users.

## A11Y-1 Screens people can't use

**Applies:** public web pages and apps, most of all shops, bookings, banking and anything people must use.

**Find:** in the code: images without `alt` (or decorative ones without `alt=""`), inputs without a `<label>` or
`aria-label`, clickable `div`s and `span`s without a role, keyboard handling and `tabIndex`, `outline: none` with no
`:focus-visible` style, text and controls below 4.5:1 contrast (3:1 for large text and UI parts; compute it from the
colour tokens), targets smaller than 24 by 24 px, motion with no `prefers-reduced-motion` path, and modals that trap or
lose focus. When the owner has the app running, or says yes to starting it (SKILL.md, Proof), run axe
(`npx @axe-core/cli http://localhost:3000`) or Lighthouse's accessibility audit and quote the results.

**Fix:** labels, alt text, real buttons and links, visible focus, contrast fixed in the tokens, bigger targets, and
reduced motion. WCAG 2.2 AA is the bar both the US cases and the EU use.

**At stake:** in the US, 3,117 federal lawsuits over websites were filed in 2025, mostly against small online shops,
and many more demand letters; they ask for fixes and lawyers' fees, and California's Unruh Act adds at least $4,000 per
offence where it applies. In the EU, the European Accessibility Act has applied since 28 June 2025 to e-commerce,
banking, e-books and transport services, with fines set by each country (up to €100,000 in Germany); businesses with
fewer than 10 staff and €2 million turnover or less are exempt for services.

## UGC-1 Takedowns and illegal content

**Applies:** apps that host what users upload or post.

**Find:** a copyright takedown process (a DMCA agent registered with the US Copyright Office and named on the site,
and a repeat-infringer policy); terms of service that say what's allowed and that the owner can remove content; a path
for reporting illegal content; for image and video uploads, what happens if child sexual abuse material is found (US
providers must report it to NCMEC when they learn of it).

Since 19 May 2026 the TAKE IT DOWN Act also requires a plain notice of how to report nonconsensual intimate images
(reachable without an account) and removal of the reported image and its copies within 48 hours.

**Fix:** register the DMCA agent ($6, renewed every three years), publish the takedown process and terms, add the
intimate-image reporting notice, and wire reports to someone who acts on them within the deadlines.

**At stake:** the DMCA safe harbour only protects a host that has a registered agent and acts on notices; without it,
the owner can be liable for users' uploads. A missed 48-hour removal is up to $53,088 per violation.
