# AGENTS.md

Product specs live in `specs.md`. Read it before feature work, and ask if it conflicts with this file.

## Stack

Node 22, Next.js 16 (App Router, Turbopack), TypeScript (strict), Tailwind CSS, shadcn/ui, Zod, Tesseract.js (server-side), Vitest + React Testing Library, Playwright, ESLint + Prettier, npm.

Not used: databases, ORMs, authentication, internationalization, analytics, or tracking. Don't add any of them without asking.

## Before finishing

Run lint, format check, type-check, and relevant tests, then verify the change in the running app.

## Components

- Use Server Components by default. Add `"use client"` only for state, effects, event handlers, or browser APIs, as low in the tree as possible.
- Prefer shadcn/ui components over custom ones, and add them with the shadcn CLI.
- Use `next/image`, `next/link`, and `next/font` instead of raw elements.
- Lazy-load heavy client libraries with dynamic imports.
- Use kebab-case file names, PascalCase component names, and named exports, except where Next.js requires a default export.
- Import through the `@/` alias.

## Routing and rendering

- Prefer static rendering; add request-time server logic only when required.
- Cover every route with an `error.tsx`, and the root layout with `global-error.tsx`. Add `loading.tsx` and Suspense for slow sections.
- Define metadata with the Metadata API on every page.
- Don't add `proxy.ts` (formerly middleware) unless asked.
- Don't use browser APIs, random values, or the current time during render; server and client output must match.
- Don't use a global state library. Keep form state local and shareable state in the URL.

## Data

- Validate all external input (forms, URL data, API bodies) with Zod.
- Define each schema once and derive types from it.

## PWA

- Write service workers by hand, without a service worker library.
- Precache every asset a feature needs to work offline.
- Verify offline behavior after any change to an offline-capable page.
- Keep the app installable on iOS Safari and Android Chrome.

## TypeScript

- Don't use `any` or non-null assertions; use `unknown` and narrow it.

## Styling and accessibility

- Style with Tailwind utilities, not inline styles. Use global CSS only for shadcn/ui theme tokens.
- Support light and dark mode through theme tokens; never hard-code colors.
- Use semantic HTML, label every input, add alt text, and make all controls keyboard-operable.
- Target the last two versions of Chrome, Safari (including iOS), Firefox, and Edge.

## Configuration and security

- Validate environment variables with Zod at startup in a single module, and read them only through it.
- Keep secrets in `.env.local` and never expose them through `NEXT_PUBLIC_`. Keep `.env.example` current.
- Never render unsanitized HTML, and escape user data in every generated file.
- Set security headers (Content-Security-Policy, Strict-Transport-Security, Referrer-Policy, X-Content-Type-Options, Permissions-Policy) in `next.config`.
- Rate-limit every public endpoint that writes data or does heavy work.
- Check `Content-Type` and enforce a body size limit before parsing a request.
- Bound expensive work with a queue limit and a timeout.
- Limit decoded image dimensions, not only file size.
- Never expose user data, or links and IDs that lead to it, in public streams, logs, or error messages.
- Validate path parameters and allowlist file names before reading from disk.
- Return generic error messages to clients; log details server-side.

## Deployment

- Deploy as a Docker image built with `output: "standalone"`, running as a non-root user with `NODE_ENV=production`.
- Pin Node 22 via `.nvmrc` and `engines` in `package.json`.
- Install with `npm ci` in CI and Docker.
- Expose a health-check route handler that returns 200 without calling external services.
- Log structured JSON to stdout, and never log user data.
- `NEXT_PUBLIC_` variables are inlined at build time; everything else is read at runtime.
- Don't rely on Vercel-only features.
- GitHub Actions runs lint, format check, type-check, unit tests, and build; all must pass. Run e2e tests locally.

## Testing

- Vitest tests live in `tests/`, mirroring the `src/` structure; Playwright specs live in `e2e/`.
- Add or update tests for any changed behavior.
- Use Vitest for logic and components, and Playwright for critical user flows, including offline.
- Don't make external network calls or use unmocked time in tests.

## Code

- All application code lives in `src/`.
- Where this file is silent, follow existing patterns.
- Don't add dependencies or make major upgrades without asking.
- Pin dependencies to exact versions, without `^` or `~` ranges.
- Don't reformat unrelated code.
- Don't write comments in source code; use clear names instead. Tool directives (`@ts-expect-error`, `eslint-disable`, triple-slash references) are allowed when required.
- Don't perform git write operations (commit, branch, stash, push, merge requests); leave changes uncommitted for review.
