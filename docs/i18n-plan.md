# Plan: multi-language support

Status: **not implemented.** The app is currently English-only, with strings
hardcoded in components. This document is the plan for making it multilingual
later; it is not a description of existing behavior.

## Goal

Offer the interface in more than one language (starting with English and
Brazilian Portuguese, since the project began in Portuguese), without rewriting
components every time a language is added.

## Recommended approach: `next-intl`

`next-intl` is the closest fit for the App Router. It supports Server
Components, keeps the strings out of the code, and handles the locale segment in
the URL without a custom router.

The alternatives were weighed and set aside:

- **Hand-rolled dictionary + React context.** Cheapest to start, but re-invents
  plural rules, date/number formatting, and locale negotiation, and doesn't work
  cleanly in Server Components. Rejected: this app renders most text on the
  server.
- **`react-i18next`.** Mature, but its Server Component story on the App Router
  is still awkward, and it leans client-side.

## Shape of the change

### 1. Locale in the URL

Move the routes under a `[locale]` segment:

```
src/app/[locale]/(app)/page.tsx
src/app/[locale]/(app)/reports/page.tsx
src/app/[locale]/(app)/settings/page.tsx
src/app/[locale]/login/page.tsx
```

`/en/settings`, `/pt-br/settings`. URL-visible locale is the honest default: it
is shareable, cacheable, and crawlable, and it makes the current language
obvious.

The `/api/*` routes stay outside the segment. They return data and error
**codes**, not translated prose (see §4).

### 2. Message catalogs

One JSON file per locale, keyed by a stable dotted path:

```
messages/en.json
messages/pt-br.json
```

```json
{
  "settings.title": "Settings",
  "settings.keyPrivacy": "It lives only inside the encrypted session cookie…",
  "login.scopeExplanation": "GitHub will ask for permission to read your profile…"
}
```

The English catalog is extracted from the current hardcoded strings; that
extraction is the bulk of the migration work. Portuguese is then a second file,
not a second code path.

### 3. Locale detection

Order of precedence:

1. The `[locale]` segment in the URL, when present.
2. A `NEXT_LOCALE` cookie, set when the user picks a language.
3. The `Accept-Language` header, negotiated against the supported set.
4. Fallback to `en`.

A small `middleware.ts` redirects a locale-less path to the negotiated locale.
This is the one place middleware earns its keep here; the session check stays in
the `(app)` layout (see the comment in `src/app/(app)/layout.tsx` for why session
reads are kept on the Node runtime, not the edge).

### 4. Error messages: codes, not prose

The API already returns machine-readable reasons alongside the human message
(`reason: "insufficient_credits"`, `error: "This key has no credits…"` in
`src/lib/llm/models.ts`, and the `AuthFailure` union in
`src/lib/auth/github-oauth.ts`). The migration leans on that: the client maps the
**code** to a translated string from the catalog, and the server's English prose
becomes a fallback for codes the client doesn't recognize.

This is why `describeCredentialError` returns a typed union instead of only a
string: the union is already the translation key.

### 5. Generated content stays separate

The **report** the LLM writes is not UI text. Its language should follow a user
choice passed into the prompt (a `reportLanguage` field), independent of the
interface locale: someone may want the app in English but the client-facing
report in Portuguese. The PDF renderer takes the already-written text and does
not translate.

## Rollout

1. Add `next-intl`, the `[locale]` segment, and `messages/en.json`; move every
   hardcoded string into the catalog. No visible change yet: English only,
   served under `/en`.
2. Add `messages/pt-br.json` and a language switcher in the user menu.
3. Wire the error-code → catalog mapping on the client.
4. Add `reportLanguage` to generation, once the generator exists.

Step 1 is the large one and is worth its own PR. Steps 2–4 are incremental.

## Cost of waiting

Every hardcoded string added between now and step 1 is one more string to
extract later. That's acceptable while the app is small, and it's the reason
this is a plan rather than a blocker: the extraction is mechanical, and doing it
now would slow the features that still need building.
