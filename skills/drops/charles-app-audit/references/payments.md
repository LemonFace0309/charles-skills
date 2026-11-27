# Payments and subscriptions

Contents: [PAY-1 webhooks nobody verifies](#pay-1-webhooks-nobody-verifies) · [PAY-2 prices from the browser](#pay-2-prices-from-the-browser) · [PAY-3 access granted on the success page](#pay-3-access-granted-on-the-success-page) · [PAY-4 plan status that drifts or can be written](#pay-4-plan-status-that-drifts-or-can-be-written) · [PAY-5 events handled twice](#pay-5-events-handled-twice) · [PAY-6 card numbers on your server](#pay-6-card-numbers-on-your-server) · [PAY-7 subscription sign-up and cancelling](#pay-7-subscription-sign-up-and-cancelling) · [PAY-8 the stores' payment rules](#pay-8-the-stores-payment-rules) · [PAY-9 card testing and the secret key](#pay-9-card-testing-and-the-secret-key) · [PAY-10 holding other people's money](#pay-10-holding-other-peoples-money)

Money is where a stranger gains the most from a small mistake: a paid plan for free, a refund that never happened, a
charge the customer never agreed to. The examples use Stripe; the same checks apply to Lemon Squeezy, Paddle, PayPal
and RevenueCat webhooks.

## PAY-1 Webhooks nobody verifies

**Applies:** every payment webhook route.

**Find:** the webhook handler (`grep -rlE "checkout\.session\.completed|invoice\.paid|customer\.subscription" --exclude-dir=node_modules .`).
It must call `stripe.webhooks.constructEvent(rawBody, signature, endpointSecret)` (or `constructEventAsync` on edge
runtimes) on the raw body before reading the event. Findings: `await req.json()` or a parsed body used without that
call; the verification wrapped in a `try` that carries on when it fails; a signing secret with a fallback (references/
secrets.md, SEC-5); a handler that re-fetches nothing and trusts amounts or ids in the event.

**Prove:** quote the handler. Don't post a test event to production.

**Fix:** read the raw body (`await req.text()` in the App Router; frameworks that parse JSON first break the
signature), verify the signature with the library's default timestamp tolerance (never 0), return 400 when it fails,
and for anything that grants access, re-read the object from Stripe (`stripe.checkout.sessions.retrieve`) before
acting.

**At stake:** anyone who finds the route POSTs a fake "payment succeeded" and upgrades any account. Critical.

## PAY-2 Prices from the browser

**Applies:** checkout, cart and invoice creation.

**Find:** amounts, `unit_amount`, `price_data`, discounts, currency or quantity taken from the request body; a Stripe
`price` id from the client used without checking it against an allow-list (a client can pick a cheaper or a test
price); coupon codes checked only in the browser; quantities that can be zero or negative.

**Fix:** the client sends a product id and quantity; the server looks up the price, checks the quantity is a whole
number from 1 up, and applies discounts itself.

**At stake:** a $1 checkout for a $500 plan. On every "how vibecoded apps get hacked" list as "edited the price".

## PAY-3 Access granted on the success page

**Applies:** apps that unlock something after Checkout or a payment link.

**Find:** access granted in the page or route behind `success_url` (a `?session_id=` read but never checked, or a plain
`/success` page that sets `plan = "pro"`), or in client code after `redirectToCheckout` resolves.

**Fix:** grant access from the verified webhook (`checkout.session.completed` with `payment_status` `paid`, or
`invoice.paid`), and make the success page only show what the webhook already did.

**At stake:** anyone who types the success URL gets the paid plan.

## PAY-4 Plan status that drifts or can be written

**Applies:** subscriptions.

**Find:** the plan stored in a table or document the user can update (references/data-access.md, DB-3); no handling of
`customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`, so access outlives the
subscription; plan checks only in the browser (API-4).

**Fix:** the plan is written only by the webhook handler, read on the server for every paid feature, and ends when the
subscription does.

**At stake:** paid plans for free, kept forever.

## PAY-5 Events handled twice

**Applies:** every webhook handler that grants, credits or emails.

**Find:** no record of processed event ids; credits added with `+=` on each delivery; Stripe calls that create charges or
refunds without an idempotency key. Providers retry deliveries, so a handler that isn't idempotent runs more than once.

**Fix:** store each event id and skip ones already handled (a unique constraint does it); pass `idempotencyKey` on
creates; set state ("plan = pro") rather than add to it where you can.

**At stake:** double credits, double emails, double refunds.

## PAY-6 Card numbers on your server

**Applies:** any payment form.

**Find:** a card number, expiry or CVC field that posts to the app's own server or is logged (`name="cardNumber"`, a
custom form sending card data to `/api/`), rather than Stripe Checkout, Payment Links, Elements or the provider's
hosted page.

**Fix:** use the hosted checkout or Elements, so card data goes straight to the provider and the app stays in the
smallest PCI DSS scope (self-assessment questionnaire A, which since March 2025 also asks the merchant to confirm its
payment page isn't open to script attacks: keep third-party scripts off it). Never log payment fields.

**At stake:** PCI DSS: card data on your server means the full assessment, and a breach of it means fines from the card
networks, passed on by your processor.

## PAY-7 Subscription sign-up and cancelling

**Applies:** subscriptions, free trials that turn into paid plans, and anything that renews.

**Find:** the purchase screen and the cancel flow. Before the customer pays: the price, how often it renews, when the
first charge comes after a trial, and how to cancel, next to the button, and a clear yes (not a pre-ticked box).
After: a confirmation email with the same terms and how to cancel. Cancelling: online, in the same place they signed
up, without a call, a chat or a stack of retention screens.

**Fix:** put the terms next to the button, send the confirmation, and offer cancellation online (Stripe's customer
portal does it); remind trial users before the first charge.

**At stake:** California's automatic renewal law, tightened from 1 July 2025, requires clear terms, express consent and
an online way to cancel. Federally, the FTC enforces ROSCA at up to $53,088 per violation: Amazon agreed to pay $2.5
billion over Prime in September 2025, and Shutterstock $35 million in May 2026 over an eight-screen cancel flow. For
EU customers, since 19 June 2026 an online contract with a right to withdraw needs a "withdraw from contract here"
button with a confirmation step.

## PAY-8 The stores' payment rules

**Applies:** iOS and Android apps that sell anything.

**Find:** what's sold inside the app and how it's paid. Digital goods and features used in the app (subscriptions,
credits, unlocks) are paid through the store's billing; physical goods and real-world services must not be. A Stripe
checkout for digital goods inside an iOS app is allowed with an external link only on the US storefront since the
court ruling of 30 April 2025 (Apple may still set a fee for link-outs); elsewhere it's a rejection. Google Play
allows US link-outs since October 2025 and otherwise requires its billing for digital goods, except where an
alternative billing programme applies.

**Fix:** store billing (RevenueCat makes it simpler) for digital goods, or a US-only external link where allowed, and
Stripe only for physical goods and services.

**At stake:** rejection at review, or removal of a live app.

## PAY-9 Card testing and the secret key

**Applies:** apps that create payments or save cards from their own forms or routes, and every app holding a Stripe
secret key.

**Find:** routes that create PaymentIntents or SetupIntents without a session, a CAPTCHA or a limit per IP and account
(fraudsters script them to test stolen cards); free trials that ask for a card with no limits; and the secret key
itself: a full-access `sk_live_` where a restricted key (`rk_live_`) with only the needed permissions would do, no IP
restriction, never rotated. Mostly "Needs checking" for the key's settings.

**Fix:** Checkout or the Payment Element, which come with their own protections; sign-in before paying; a CAPTCHA checked
on the server; limits on new customers and cards per IP and per account; Radar rules for velocity; a restricted key
limited to the server's IP addresses, rotated on a schedule.

**At stake:** thousands of tiny charges on stolen cards, then the disputes, fees and a payment account under review.

## PAY-10 Holding other people's money

**Applies:** marketplaces and platforms that take payments for someone else (sitters, sellers, creators, drivers) and
pay them out, and apps holding balances or wallets.

**Find:** payouts made by hand or from the owner's own Stripe balance to other people; a `balance` or `wallet` the app
keeps for users; refunds and disputes with no rule for who covers them.

**Fix:** a marketplace product built for it (Stripe Connect, or the provider's equivalent), so the provider verifies
the people being paid and holds the funds; written terms for fees, refunds and disputes.

**At stake:** collecting money and passing it on can make the app a money transmitter, which needs licences state by
state; the platform products exist so it doesn't.
