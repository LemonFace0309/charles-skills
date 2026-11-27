# Kids and sensitive data

Contents: [KID-1 children under 13](#kid-1-children-under-13) · [KID-2 teens and age checks](#kid-2-teens-and-age-checks) · [SENS-1 faces, voices and fingerprints](#sens-1-faces-voices-and-fingerprints) · [SENS-2 health data](#sens-2-health-data) · [SENS-3 precise location](#sens-3-precise-location)

Some data costs far more to get wrong: children's, and data about bodies, health and where someone is. These laws come
with per-person or per-violation amounts, and with lawyers who look for apps that break them.

## KID-1 Children under 13

**Applies:** an app aimed at children (its subject, characters, art, ads, or an audience that's largely kids), or one
whose owner knows children under 13 use it. In the US that's COPPA; the UK's Children's Code and GDPR's rules on
children go further.

**Find:** the signals that it's aimed at kids (games, cartoons, school, "for kids" copy, a kids' category in the
store); an age question at sign-up and whether it's neutral (asks for a birth date without hinting at the answer and
doesn't let people retry); what's collected before a parent agrees, where persistent identifiers count (cookies,
device ids, advertising ids, analytics user ids); third-party SDKs (ads, analytics, attribution, session replay)
running for under-13s.

**Fix:** a neutral age gate; for under-13s, no third-party tracking or ads and nothing collected beyond what's needed
until a parent gives verifiable consent; separate consent before sharing their data with third parties; a written
security programme and a retention limit. The FTC's amended COPPA rule took effect in June 2025, with compliance due by
22 April 2026.

**At stake:** civil penalties of up to $53,088 per violation (the 2025 amount, which stayed for 2026). HyperBeard, a
small studio, paid $150,000 in 2020 for ad trackers in its kids' games; Disney paid $10 million in 2025 for videos not
marked "made for kids"; TikTok agreed in August 2026 to a $300 million penalty, plus $100 million more in some cases,
over under-13 accounts and ignored deletion requests.

## KID-2 Teens and age checks

**Applies:** apps on the App Store or Google Play, social and chat apps, and apps teens use.

**Find:** whether the app asks for or uses an age at all; whether it has features the new state laws target (open
messaging with strangers, feeds, companion chatbots); and which app store age-verification laws reach it. They put
duties on developers to read the age signal the store or phone provides and limit what minors get: Texas's has been
enforced since June 2026, California's AB 1043 starts 1 January 2027 ($2,500 per child, $7,500 if intentional),
Utah's moved to 6 May 2027 and Louisiana's to 1 July 2027 (up to $10,000 per violation). Dates have moved before, so
check the current status. Under AB 1043, an "under 13" signal means the app knows, which brings in COPPA (KID-1).

**Fix:** read the store's age signal where it's offered (Apple's Declared Age Range, Google Play's Age Signals) and
limit features for minors; for companion chatbots, references/ai.md, AI-6.

**At stake:** state attorneys general enforce these laws per violation; some add private lawsuits.

## SENS-1 Faces, voices and fingerprints

**Applies:** anything that scans faces, matches selfies to ids, builds face or voice models, clones voices, or reads
fingerprints or hand geometry, including through a vendor (ID verification, face filters, "try on", voice cloning).

**Find:** imports and calls to face and voice services (AWS Rekognition, Azure Face, Google Vision face detection,
face-api.js, MediaPipe face landmarks sent to a server, Persona, Onfido, Veriff, voice-cloning APIs); face templates
or embeddings stored in the database or storage; and whether a consent screen comes before the camera or microphone,
a public retention and destruction policy exists, and the data is deleted on time.

**Fix (Illinois' BIPA, the strictest):** a written, public retention and destruction policy; written consent (an
electronic signature counts) before collecting, telling the person what's collected, why and for how long; no selling
or profiting from it; deletion when the purpose ends and within three years of their last interaction. Texas's CUBI
asks for consent, no selling, and deletion within a reasonable time, no later than a year after the purpose ends. Do it on the device when
you can, and keep nothing.

**At stake:** BIPA gives each person $1,000 per negligent violation and $5,000 per reckless or intentional one; since
August 2024 that's once per person, not per scan (and in April 2026 a federal appeals court applied that to pending
cases). Facebook settled for $650 million (2021). Texas's CUBI carries up to $25,000 per violation, and its attorney
general got $1.4 billion from Meta (2024) and $1.375 billion from Google (2025).

## SENS-2 Health data

**Applies:** period and fertility tracking, therapy and mental health, symptoms, medications, conditions, fitness tied
to conditions, and anything that infers health from behaviour.

**Find:** which health data the app stores and where it goes; ad or analytics pixels on health pages (Meta, Google,
TikTok); consent before collecting and before sharing.

**Fix:** no ad pixels on health pages; consent to collect, separate consent to share; a policy that names each
recipient. HIPAA rarely applies to consumer apps, but these laws do.

**At stake:** Washington's My Health My Data Act has no size threshold and lets people sue. The FTC has gone after health apps that shared data
for ads: GoodRx paid $1.5 million in 2023, the first case under its Health Breach Notification Rule, and BetterHelp
paid $7.8 million the same year.

## SENS-3 Precise location

**Applies:** apps that collect GPS or fine location, especially in the background, or share it with SDKs.

**Find:** location permissions requested (`Always` versus `When In Use`, `ACCESS_BACKGROUND_LOCATION`), what's sent and
to whom (ad and analytics SDKs), and how long it's kept. Photos with GPS data in EXIF (references/injection.md, INJ-5).

**Fix:** ask only when a feature needs it, use approximate location where it's enough, never share or sell it, and set
a retention limit.

**At stake:** the FTC has banned data brokers from selling sensitive location data (X-Mode and InMarket, 2024), and
state privacy laws treat precise location as sensitive data that needs consent.
