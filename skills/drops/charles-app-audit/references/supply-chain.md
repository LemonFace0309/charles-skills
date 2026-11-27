# Supply chain and deployment

Contents: [DEP-1 framework versions with known holes](#dep-1-framework-versions-with-known-holes) · [DEP-2 vulnerable packages](#dep-2-vulnerable-packages) · [DEP-3 packages that aren't what they seem](#dep-3-packages-that-arent-what-they-seem) · [DEP-4 debug and test routes left on](#dep-4-debug-and-test-routes-left-on) · [DEP-5 previews and environments](#dep-5-previews-and-environments) · [DEP-6 CI and agent config](#dep-6-ci-and-agent-config) · [DEP-7 licences](#dep-7-licences)

Vibecoded apps pin whatever the template shipped and rarely update, so a framework hole published since then is often
the easiest way in. Check the installed versions in the lockfile, not the ranges in `package.json`.

## DEP-1 Framework versions with known holes

**Applies:** every app.

**Find:** the installed versions (`npm ls next react react-dom react-server-dom-webpack`, or the lockfile). Two that
are exploited in the wild:
- **React Server Components remote code execution** (React2Shell, CVE-2025-55182, and CVE-2025-66478 for Next.js;
  CVSS 10, December 2025):
  `react-server-dom-webpack`, `-parcel` and `-turbopack` 19.0, 19.1.0, 19.1.1 and 19.2.0, which Next.js, React Router's
  RSC mode, Waku, `@vitejs/plugin-rsc` and rwsdk ship. Follow-up fixes for denial of service and source code exposure
  came through January 2026. React's advisory lists, as of 26 January 2026, Next.js 14.2.35, 15.0.8, 15.1.12, 15.2.9,
  15.3.9, 15.4.11, 15.5.10, 16.0.11 and 16.1.5 as the patched release of each line; 13.3 to 13.5 move to 14.2.35.
- **Next.js middleware bypass** (CVE-2025-29927, March 2025): on self-hosted apps before 12.3.5, 13.5.9, 14.2.25 and
  15.2.3, a request with an `x-middleware-subrequest` header skips middleware, so auth that lives only there is gone
  (references/data-access.md, API-3). Apps on Vercel weren't affected.

Then run the audit tool (`npm audit --omit=dev`, `pnpm audit --prod`, `yarn npm audit` on Yarn 2 and later or
`yarn audit` on Yarn 1, `bun audit`, or
`osv-scanner scan -L <lockfile>`) and check anything it rates high or critical against CISA's Known Exploited
Vulnerabilities list.

**Fix:** upgrade to the latest patch release of the same line (check the framework's security page for anything newer
than the list above; `npx fix-react2shell-next` does it for Next.js), rebuild and redeploy. Next.js says an app that was
online and unpatched at 1 p.m. Pacific on 4 December 2025 should rotate its secrets, and that goes for any exposed
remote-code-execution hole: rotate every secret the server could read.

**At stake:** the server itself. React2Shell was exploited within hours of disclosure.

## DEP-2 Vulnerable packages

**Applies:** every app.

**Find:** the audit tools in DEP-1, production dependencies first; packages whose repository is archived or that
haven't had a release in years; `postinstall` or `preinstall` scripts in dependencies (`npm query ":attr(scripts, [postinstall])"`);
no lockfile in the repo, so every install can pull different versions (and the audit has nothing fixed to check).

**Fix:** upgrade, replace or remove, and commit the lockfile. A vulnerability in a dev-only tool that never ships is
Low; say why.

**At stake:** whatever the vulnerable package touches.

## DEP-3 Packages that aren't what they seem

**Applies:** every app, especially one whose dependencies an AI chose.

**Find:** for each dependency an AI added (check `git log -p -- package.json`), confirm it exists with a real history:
`npm view <name> time.created repository.url` and its weekly downloads. Red flags: a name one letter off a popular
package, a package created recently with few downloads, no repository, or an install script that reads env vars or
makes network calls. Models invent package names, and attackers register the names they invent ("slopsquatting").

**Fix:** remove it and use the well-known package; check the lockfile's resolved URLs point at the official registry.

**At stake:** malware that runs at install, on the developer's laptop and in CI, with every secret they hold. In a
study of 576,000 code samples from 16 models (USENIX Security 2025), 19.7% of recommended packages didn't exist, and 43%
of the made-up names came back every time the prompt was rerun, which is what makes registering them worth an
attacker's while. Shai-Hulud, a self-spreading npm worm, hit more than 500 packages in September 2025 and about 800
more in November, stealing tokens through install scripts.

## DEP-4 Debug and test routes left on

**Applies:** every deployed app.

**Find:** routes named `debug`, `test`, `seed`, `reset`, `dev`, `playground` or `health` that do more than return OK;
GraphQL introspection or a GraphiQL/Swagger UI in production; `debug: true` or verbose error pages in production config;
`NODE_ENV` checks missing around dev-only code; admin scaffolds the template generated.

**Fix:** delete them, or guard them with an admin check and disable them in production builds.

**At stake:** a seed route that wipes the database, or an introspection map of every query.

## DEP-5 Previews and environments

**Applies:** apps with preview, staging or branch deployments.

**Find:** preview deployments using production env vars or the production database (Vercel: Settings, Environment
Variables, which environments each variable is set for); preview URLs open to the public (Vercel Deployment
Protection; Netlify deploy previews are public unless password-protected); staging seeded with real users' data;
preview deploys of pull requests from forks that receive secrets.

**Fix:** separate databases and keys for preview, deployment protection on, fake data in staging.

**At stake:** production data behind a URL nobody is watching.

## DEP-6 CI and agent config

**Applies:** repos with GitHub Actions or other CI, and repos with AI agent config (`.claude/`, `.cursor/`, `AGENTS.md`,
MCP config).

**Find:** `pull_request_target` workflows that check out the pull request's code; secrets echoed into logs; third-party
actions not pinned to a commit; AI agents in CI given secrets and untrusted input (issues, PR text); committed MCP
config or agent settings with tokens, or with permissions set to skip every prompt; coding agents or MCP servers
connected to the production database or with its secret key (Supabase's MCP server has read-only and project-scoped
modes); rules files that tell an agent to skip security checks (SKILL.md, Proof).

**Fix:** `pull_request` instead of `pull_request_target` for untrusted code, actions pinned by SHA, least-privilege
tokens, no secrets in agent jobs that read untrusted text, and agents pointed at a development database, read-only,
with approval on every tool call.

**At stake:** the repo, its secrets and its releases, and the data itself: in July 2025 Replit's agent deleted a
production database during a code freeze, and researchers showed a support ticket could make an agent with Supabase's
service key copy private tables into the ticket.

## DEP-7 Licences

**Applies:** closed-source apps and apps sold to others.

**Find:** `npx license-checker --production --summary` (or the package manager's licence report). AGPL code in a hosted
app means offering its source to users; GPL in a shipped mobile or desktop app means releasing yours. Check fonts and
images too: a font licensed for print only, or a stock image without a licence.

**Fix:** replace the package or asset, or comply with its licence.

**At stake:** a demand to release the app's source, or to pay for what was used.
