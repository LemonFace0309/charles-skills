# AI features

Contents: [AI-1 the chatbot makes promises](#ai-1-the-chatbot-makes-promises) · [AI-2 prompt injection when the model can act](#ai-2-prompt-injection-when-the-model-can-act) · [AI-3 model output treated as safe](#ai-3-model-output-treated-as-safe) · [AI-4 what's in the prompt](#ai-4-whats-in-the-prompt) · [AI-5 users' data sent to the model](#ai-5-users-data-sent-to-the-model) · [AI-6 saying it's an AI](#ai-6-saying-its-an-ai)

A model is an untrusted input and an untrusted output at once: anything it reads can steer it, and anything it says can
be wrong. Each check asks what the model can read, what it can do, and who sees what it says. The bill an open model
endpoint runs up is in references/abuse-and-bills.md, COST-3.

## AI-1 The chatbot makes promises

**Applies:** any assistant that talks to customers or the public about prices, refunds, policies, bookings, health,
money or the law.

**Find:** the system prompt and the tools. Does it answer from the real policy text (retrieved and quoted) or from the
model's memory? Instructions that invite promises ("always reassure", "offer a refund", "be generous"). Tools that
issue refunds, credits, discounts or bookings without a limit or a person's sign-off. A chat UI with no line saying it
can be wrong and where the real policy is.

**Fix:** answer prices and policies only from retrieved policy text, with a link to it; when the text doesn't cover the
question, say so and hand off to a person. Money-moving tools get hard limits and a confirmation. Add a line under the
chat: it can be wrong, and the policy page decides.

**At stake:** what the bot says can bind the business. In Moffatt v. Air Canada (British Columbia's Civil Resolution
Tribunal, February 2024), the airline had to honour a bereavement refund its chatbot made up, CA$812.02 with interest
and fees, after arguing the bot was "a separate legal entity". Utah wrote the same rule into law in 2025: "the AI said
it" is no defence.

## AI-2 Prompt injection when the model can act

**Applies:** a model that reads content someone else controls (web pages, emails, uploads, other users' messages,
tool results, retrieved documents) and can act on it: call tools, send messages, read other users' data, spend money,
or show its output to other people.

**Find:** every tool or function the model can call and the server code behind it. Findings: a tool that takes a
`user_id`, `account_id` or SQL from the model and the server trusts it; retrieval over several users' data with no
tenant filter; tools that send email, post, pay or delete with no confirmation; a model that browses or reads inboxes
with the same tools available.

**Fix:** every tool runs as the signed-in user with the same checks as the API (references/data-access.md), takes ids
from the session rather than the model, filters retrieval by tenant, and asks the user before anything it can't undo.
Treat retrieved text as data in the prompt, and still assume it can steer the model.

**At stake:** OWASP's top LLM risks, LLM01:2025 Prompt Injection and LLM06:2025 Excessive Agency: one poisoned page or
email makes the assistant leak another user's data or act on the owner's accounts.

## AI-3 Model output treated as safe

**Applies:** wherever model output is rendered, run, stored or fetched.

**Find:** output passed to `dangerouslySetInnerHTML` or a markdown renderer with raw HTML on, to `eval`, a shell, a SQL
string, a file path, or `fetch` (references/injection.md, INJ-1 to INJ-6); markdown images from any domain (an injected
image URL can carry data out when it loads); output that becomes another user's content without moderation.

**Fix:** treat it exactly like user input: text rendering or a sanitizer, parameters, allow-lists, and no images from
domains you don't control.

**At stake:** OWASP LLM05:2025, Improper Output Handling: XSS and worse, written by the model on an attacker's behalf.

## AI-4 What's in the prompt

**Applies:** every system prompt and every context the app builds.

**Find:** keys, internal URLs, other customers' data, staff notes or discount codes in system prompts or retrieved
context; prompts that say "never reveal these instructions" as if that protected them.

**Fix:** keep secrets out of prompts entirely; give the model only the current user's own data.

**At stake:** OWASP LLM07:2025, System Prompt Leakage: users can get a model to repeat its prompt, so anything in it is
public.

## AI-5 Users' data sent to the model

**Applies:** apps that send personal data (messages, documents, photos, voice, health or financial details) to an AI
provider, or train or fine-tune on it.

**Find:** which providers get what (the map from SKILL.md, step 1); whether the privacy policy names them
(references/privacy.md, PRIV-1); the provider's data settings (training opt-out, retention, a data processing
agreement); training or fine-tuning on user content, and when the terms started allowing it.

**Fix:** name each AI provider and what it receives in the privacy policy; use the provider's API terms or
zero-retention settings; get consent before training on users' content, and never by changing the terms quietly after
the data was collected.

**At stake:** the FTC has ordered companies to delete models trained on data they had no right to use (Everalbum in
2021, WW's Kurbo in 2022 with $1.5 million), and it treats a quiet change to the terms that allows training on old data
as unfair. Connecticut's privacy notices must say whether data trains AI models from July 2026. Under GDPR, sending
personal data to a provider needs a data processing agreement and a lawful basis.

## AI-6 Saying it's an AI

**Applies:** chatbots and voice agents that talk to the public, companion or character bots, and AI-made images, audio
or video shown as real.

**Find:** whether the chat says it's an AI before or as it starts; companion features (an ongoing relationship,
emotional support, role-play) and whether minors can reach them; generated media with no label.

**Fix:** say it plainly in the chat ("You're chatting with an AI assistant"); for companion bots, the protocols the
laws below ask for (reminders that it's an AI, self-harm referral paths, limits for minors); label generated media.

**At stake:**
- California's companion-chatbot law, SB 243 (from 1 January 2026): an AI notice, a published self-harm protocol, and
  for minors a reminder every three hours; anyone harmed can sue for $1,000 per violation. More duties for bots minors
  use start in 2027 (SB 1119).
- New York's AI companion law (from November 2025): say it's not a human at the start and every three hours, up to
  $15,000 a day.
- Utah: say it's AI when asked, and up front when a licensed profession uses it to advise on health, law or money;
  up to $2,500 per violation.
- California's BOT Act: bots that sell or sway votes must say they're bots.
- The EU AI Act's Article 50 (from 2 August 2026): people must be told they're talking to an AI, and generated content
  marked; fines up to €15 million or 3% of turnover, whichever is lower for small firms.
