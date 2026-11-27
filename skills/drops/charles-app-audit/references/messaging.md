# Texts, calls and email

Contents: [MSG-1 marketing texts without written consent](#msg-1-marketing-texts-without-written-consent) · [MSG-2 opt-outs that don't stick](#msg-2-opt-outs-that-dont-stick) · [MSG-3 sending at night](#msg-3-sending-at-night) · [MSG-4 unregistered texting](#msg-4-unregistered-texting) · [MSG-5 AI and recorded voice calls](#msg-5-ai-and-recorded-voice-calls) · [MSG-6 marketing email](#msg-6-marketing-email)

The line that matters is marketing versus transactional. A login code or a booking confirmation the person asked for
is transactional. A deal, a "we miss you" or a new-feature announcement is marketing, and marketing texts and calls in
the US need written consent kept on record. The abuse side (bots triggering sends) is in references/abuse-and-bills.md.

## MSG-1 Marketing texts without written consent

**Applies:** any promotional text to US numbers sent automatically (a scheduler, a campaign tool, a trigger).

**Find:** the opt-in on sign-up or checkout and the code that stores it. It needs: a checkbox that starts unticked
(`defaultChecked`, `checked` by default, or opt-in folded into "I agree to the terms" all fail), separate from the
terms and not required to buy; text beside it naming the business, saying the texts are automated marketing, how
often, that rates may apply, that consent isn't a condition of purchase, and "reply STOP to opt out"; and a record
of who agreed, when, from which number and IP, and the exact words shown. Then the senders: a marketing send to every
user with a phone number, rather than only those who opted in, is a finding.

**Fix:** an unticked, separate checkbox with that text; a consent log written with the opt-in; marketing sends that
query only opted-in numbers.

**At stake:** the TCPA lets each person sue for $500 per text, $1,500 if the sender knew, and class actions multiply it
by every recipient.

## MSG-2 Opt-outs that don't stick

**Applies:** any texting, marketing or not.

**Find:** handling of STOP, QUIT, END, REVOKE, OPT OUT, CANCEL and UNSUBSCRIBE on inbound messages, in any case (Twilio's Advanced Opt-Out does it for
a Messaging Service; a raw number with a custom webhook may not), an opted-out list that marketing sends check, and
opt-outs that arrive any other way (an email, a reply in other words, a support chat) being honoured too.

**Fix:** use the provider's opt-out handling, mirror opt-outs into the app's own list, check it before every marketing
send, and confirm the opt-out with one final text.

**At stake:** every text after an opt-out is a new TCPA violation. The FCC's rules give ten business days to honour
one. From 25 November 2026 a sender may name one exclusive way to opt out, but a texting one has to accept all seven
standard words ("stop", "quit", "end", "revoke", "opt out", "cancel", "unsubscribe") and say how in every message;
without an exclusive method, any reasonable way of saying no counts. A no in reply to marketing ends all marketing.

## MSG-3 Sending at night

**Applies:** scheduled or bulk marketing texts and calls.

**Find:** sends scheduled in the server's time zone rather than the recipient's; campaigns with no sending window.

**Fix:** send between 9 a.m. and 8 p.m. in the recipient's local time, which sits inside the federal limit (8 a.m. to
9 p.m.) and the stricter ones some states set.

**At stake:** the TCPA bars telephone solicitations before 8 a.m. and after 9 p.m. local time, and about 90 class
actions over promotional texts sent in those hours were filed between November 2024 and March 2025. State laws
(Florida's, Oklahoma's and others) add their own damages per message.

## MSG-4 Unregistered texting

**Applies:** apps texting US numbers from ordinary 10-digit numbers or toll-free numbers.

**Find:** the sending number type in the provider's console, and whether the brand and campaign are registered for
A2P 10DLC (or the toll-free number verified). Usually "Needs checking".

**Fix:** register the brand and campaign, or verify the toll-free number, before launch.

**At stake:** carriers block or filter unregistered business texts, so login codes stop arriving, and they add fees.

## MSG-5 AI and recorded voice calls

**Applies:** apps that place calls with an AI voice, a cloned voice or a recording.

**Find:** outbound calling code (Twilio `calls.create`, voice-agent platforms) and the consent behind each number.

**Fix:** call only people who gave express consent to be called this way (written consent for marketing), identify the
business at the start, and offer an opt-out in the call.

**At stake:** the FCC ruled in February 2024 that AI-generated voices count as "artificial" voices under the TCPA, so
each unconsented call carries the same $500 to $1,500.

## MSG-6 Marketing email

**Applies:** newsletters, promotions, drip campaigns and "product updates" that sell.

**Find:** marketing templates and their footers: a working unsubscribe link, the sender's postal address, a truthful
From and subject; that unsubscribes are honoured within ten business days and the link works for at least 30 days;
marketing sent to every sign-up. For people in the EU or UK, marketing email needs opt-in consent, except to existing
customers about similar products with an easy way out.

**Fix:** an unsubscribe link and postal address in every marketing email (the email provider's subscription management
does both), honoured at once, and a consent checkbox for EU and UK sign-ups.

**At stake:** CAN-SPAM's civil penalty is up to $53,088 per email (the 2025 amount, which stayed for 2026). In the UK,
the ICO fines unsolicited marketing texts and emails: £120,000 for one company in January 2026.
