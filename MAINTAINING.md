# Maintaining this fork

`riven-tpdb-frontend` forks
[riven-frontend](https://github.com/rivenmedia/riven-frontend). Every browse,
search and detail surface is backed by ThePornDB instead of TMDB, so upstream
updates are *reviewed and merged*, not applied blindly.

The backend fork (`riven-tpdb`) carries the same policy and its own copy of
this document.

## Pulling an upstream update

```bash
./scripts/upstream-report.sh
```

It adds the `upstream` remote if missing, fetches, and prints the only thing
that decides how expensive the merge is: **which files this fork has modified
that upstream has also changed.**

```bash
git fetch upstream
git merge upstream/main
```

## What diverges

| Kind | Count | Conflict risk |
|---|---|---|
| Modified | 14 | Real — the review list |
| Deleted | 13 | Mechanical (modify/delete → stay deleted) |
| Added | 6 | None |

The deletions are TMDB-only routes and helpers (`/api/tmdb/*`,
`/api/ratings/*`, `/api/tvdb/search`, the TMDB resolver). They are gone on
purpose — this fork must not be able to surface non-adult content.

**`src/lib/providers/riven.ts` is generated** by `openapi-typescript` from the
backend's `/openapi.json`, and diverges heavily because this fork's backend
exposes far fewer routes. Never hand-merge it. Take either side and regenerate:

```bash
npx openapi-typescript@7 "http://<backend>:8089/openapi.json" -o src/lib/providers/riven.ts
```

## Rules that keep merges cheap

1. **Never reformat upstream files.** `.gitattributes` sets `* -text` so
   nothing renormalises line endings — in the backend repo that mistake once
   turned a 10-line change into 1144 conflicting lines.

2. **Route all TPDB data through the one chokepoint.**
   `src/routes/(protected)/api/tpdb/search/[type]/+server.ts` backs every
   browse surface via `SearchStore`. Convert a surface by pointing it there,
   not by adding another data path.

3. **Prefer reusing upstream components over rewriting them.** The manual
   scrape dialog is upstream's, extended with one `tpdbId` prop rather than
   forked — so upstream fixes to it still apply.

## Two traps specific to this codebase

**`openapi-fetch` needs literal path strings.** Writing
`params: { ... } as never` to silence a type error defeats inference and the
response type collapses to `never`. Branch on the literal path instead.

**The settings form submits its whole value as JSON**, not DOM `FormData` —
`setupSvelteKitForm` serialises `getValueSnapshot(form)`. Keep using it; a
plain native submit would fall back to the lossy DOM path.

## Before committing

```bash
pnpm run check     # holds at the upstream baseline: 73 errors, 24 files
pnpm run build
```

The 73 errors are inherited from upstream. That number is the baseline — it
should not grow.
