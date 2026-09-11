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

Run `./scripts/upstream-report.sh` for live counts; the shape is what
matters here.

| Kind | Conflict risk |
|---|---|
| Modified in place | Real — the review list |
| Deleted | Mechanical (modify/delete → stay deleted) |
| Added | None |

### Where the risk actually is

Measured, rather than assumed (`git diff --numstat` against the merge base,
crossed with each file's upstream commit count):

- **Roughly half of the fork's "modified" files have zero upstream history.**
  They merge for free no matter how heavily they were changed.
- **Lines we ADDED are cheap; lines we REMOVED are what conflicts.** The
  largest edits in this fork are additive (`dashboard/+page.svelte` +533/-0,
  `settings/+page.svelte` +388/-6, `hooks.server.ts` +132/-3) and are far
  safer than their size suggests. The genuinely risky files are the ones
  where upstream lines were *replaced*: `tmdb-now-playing.svelte` (+24/-47,
  15 upstream commits), `explore/+page.svelte` (+21/-70, 8),
  `lists/trending/{tv,movie}` (~+5/-60, 9 each).
- Files deleted outright look enormous in a churn count (`-415`, `-190`)
  but carry no content conflict at all — only a modify/delete prompt.

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

4. **Disable upstream features; do not excise them.** Plex sign-in is
   removed from this fork by inverting one predicate to opt-in
   (`plexEnabled()` in `src/lib/server/auth.ts`), leaving `plex-oauth.ts`
   and `/api/plex/*` untouched. The login page shows no Plex button either
   way, and every future upstream change to those files still merges. The
   same reasoning applies to any upstream feature this fork does not want:
   deleting it converts every later upstream touch into a conflict, and
   buys nothing over never enabling it.

5. **Add files rather than rewriting upstream ones**, when there is a
   choice. This is the measured reason the fork is in good shape despite
   its size: new files cannot conflict, and the fork's worst files are the
   handful where upstream lines were replaced in place.

## The television reads a manifest, not this app's markup

`riven-tv` renders the same shell -- sidebar, home rows, palette -- over
this app's API, because it cannot run this app: the target is an LG C9, so
Chromium 53, where the bundle's dynamic `import()` (63) and the stylesheet's
`oklch()` (111), `@layer` (99) and grid (57) are all discarded in silence.

Two renderers drift, and the drift is quiet -- a row added here was simply
absent there until somebody remembered to add it twice. So the shell is
described once, as data:

| File | What it is |
|---|---|
| `src/lib/tv/manifest.ts` | The rows and the nav. **Edit this to change either.** |
| `src/lib/tv/theme.ts` | Reads `themes/darkmatter.css` and converts `oklch()` to hex |
| `src/routes/(protected)/api/tv/shell/+server.ts` | Serves the above to the television |

`+page.svelte` and `sidebar.svelte` render from the manifest too, so there is
one list and not two. Adding, removing, retitling or reordering a row or a
nav entry needs no release of `riven-tv`.

**What still is not automatic:** a genuinely new *destination*. The
television skips a nav entry it has no page for, so `/collections` with
`tv: true` is silently absent there until that page is written on that side.
Set `tv: false` on anything it should not offer, rather than deleting the
entry -- the same reasoning as rule 4.

All four files are additions or edits to files with no upstream history
since the merge base, so none of this costs anything at merge time.

## Two traps specific to this codebase

**`openapi-fetch` needs literal path strings.** Writing
`params: { ... } as never` to silence a type error defeats inference and the
response type collapses to `never`. Branch on the literal path instead.

**The settings form submits its whole value as JSON**, not DOM `FormData` —
`setupSvelteKitForm` serialises `getValueSnapshot(form)`. Keep using it; a
plain native submit would fall back to the lossy DOM path.

## Before committing

```bash
pnpm run check     # holds at the upstream baseline: 74 errors, 23 files
pnpm run build
```

The 74 errors are inherited from upstream. That number is the baseline — it
should not grow.
