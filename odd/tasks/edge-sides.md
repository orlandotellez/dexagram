# Feature: relation side control (edge orientation UX)

**Branch:** `feat/dbml-import` (same branch, commits deferred to the human)
**Status:** in progress

## Intent (authorized)

Make it easy to control which side (left/right) a relation line leaves and enters an entity.
Today it is effectively impossible: `handleConnect` always pins `sourceSide`/`targetSide`, the
geometric `autoSide` therefore almost never runs, and there is no UI to change the side or to return
it to automatic.

Chosen interaction model (user-selected): **inspector segmented control + one-click flip on the
selected line + `F` keyboard shortcut.**

## Root cause

| Fact | Location |
| --- | --- |
| Sides are computed geometrically only as a fallback | `ErEditor.tsx:73` `autoSide` |
| `handleConnect` **always** writes `sourceSide`/`targetSide` from the grabbed handle, so the fallback is dead code | `ErEditor.tsx:307` |
| No UI anywhere writes or clears the sides | `Inspector.tsx` relation section |
| Once pinned, a side can never return to automatic | no `undefined` writer exists |

## Latent bug this feature activates (in scope)

`updateRelation` recomputes the edge handles with `sideHandle(relation, 'source')` **without `byId`**
(`ErEditor.tsx:459`), so the geometric fallback cannot run whenever the relation's label or fields are
edited. The symptom depends on the relation shape:

- a **field-pinned** relation with an automatic side snaps to the `'R'`/`'L'` defaults, because the
  field branch of `sideHandle` applies `?? 'R'` / `?? 'L'`;
- an **entity-level** relation with an automatic side gets `sourceHandle: undefined`, and React Flow then
  falls back to its own default handle instead of the geometric side.

Both were confirmed with a direct probe of `src/lib/sides.ts` (no `byId` -> `undefined` for the
entity-level case). Same omission in `handleConnect` and `handleReconnect`, where it is currently masked
because both pin the sides from the grabbed handle. Must be fixed, otherwise choosing "Auto" would be
immediately undone by the next label edit.

## Design

### Shared side module — `src/lib/sides.ts` (new)

Extract the side truth out of `ErEditor.tsx` so the canvas and the inspector agree:

```ts
export function oppositeSide(side: Side): Side;
export function sideOfHandle(handleId: string | null | undefined): Side | undefined;
export function autoSide(rel, byId?): { sourceSide?: Side; targetSide?: Side };
export function effectiveSide(rel, end, byId?): Side | undefined;   // may be undefined: no handle
export function concreteSide(rel, end, byId?): Side;                // never undefined
export function sideHandle(rel, end, byId?): string | undefined;    // handle id for React Flow
export function flipRelationSides(rel, byId?): Relation;            // pins both sides to the opposite
```

- `undefined` side = automatic (geometry).
- `effectiveSide` keeps today's exact semantics (field-pinned vs entity-level); `concreteSide` adds the
  `'R'`/`'L'` fallback.
- `flipRelationSides` pins both sides explicitly — after an explicit flip the intent is explicit.

### Canvas

- `RelationEdge.tsx` exports `RelationActionsContext` (`{ flip(id) }`) and renders a `⇄` button in the
  `EdgeLabelRenderer` **only when the edge is selected**.
- `ErEditor.tsx` provides the context with a **ref-backed stable value** so consumers do not re-render
  on every edge change, keeps `setEdges` and `setSelection` in sync on flip, and adds the `F` shortcut.
- The button needs `pointer-events: auto` plus `nodrag nopan`; `.er-edge-label` keeps `pointer-events: none`.

### Inspector

Two segmented controls in the relation section — `Auto | ◀ Izq | Der ▶` per endpoint — where `Auto`
writes `undefined`. Under `Auto` a muted hint shows which side geometry currently resolves to, so the
control is never a blind switch. A `⇄ Invertir` action sits next to the `Lados` subheader.

## Acceptance criteria

1. With a relation selected, clicking `⇄` on the line swaps both sides and the line visibly moves.
2. Pressing `F` with a relation selected does the same; it does nothing while typing in any input.
3. The inspector offers `Auto | Izq | Der` per endpoint; the line moves immediately on change.
4. Choosing `Auto` returns that endpoint to geometric placement, and editing the relation label
   afterwards does **not** snap it back to `R`/`L`.
5. Flipping an automatic relation pins it; flipping twice returns to the original sides.
6. Flipping preserves the field pins (`sourceFieldId`/`targetFieldId`), cardinalities and label.
7. Saving to JSON and reopening the diagram preserves the sides (existing `toEdges` path).
8. No new `lint` problems versus `HEAD`; `bun run build` succeeds; `tsc` gains no new errors.

## Non-goals

- No top/bottom handles: the model is `Side = 'L' | 'R'` and stays that way.
- No auto-relayout of every edge ("reacomodar todo") — out of scope.
- No per-field side control beyond what the existing field handles already do.

## Tasks

- [x] T1 — Feature document
- [x] T2 — `src/lib/sides.test.ts` (RED with `bun test`)
- [x] T3 — `src/lib/sides.ts` (GREEN)
- [x] T4 — `ErEditor`: import the module, pass `byId` everywhere, flip handler, context provider, `F`
- [x] T5 — `RelationEdge`: context + `⇄` button on the selected edge
- [x] T6 — `Inspector`: `Auto | Izq | Der` per endpoint + resolved-side hint + `⇄ Invertir`
- [x] T7 — CSS
- [x] T8 — README
- [x] T9 — Verify: `bun test`, `bun run lint` delta, `bun run build`, `tsc` delta
- [x] T10 — Resolve the stash-pop conflicts and the lint regressions found while resolving them

## Incident: stash-pop conflicts on `master`

While this feature was being implemented, the DBML feature was committed (`a9a7556`), pushed and
**merged to `master` via PR #1** (`e093152`). The uncommitted edge-sides work then travelled to `master`
through a branch switch and a fast-forward pull, and a `git stash pop` left the index with two unmerged
entries (`UU README.md`, `UU src/components/ErEditor.tsx`, marker sides `Updated upstream` /
`Stashed changes`). No `MERGE_HEAD` existed: it was a stash conflict, not a merge in progress.

The writer subagent was still running against that broken tree and was **cancelled** before continuing.

### Resolution

- `src/components/ErEditor.tsx` (hunk at the `applyImport` boundary): kept the **upstream** side — the
  DBML refactor (`applyImport` + the `handleImportPrisma` / `handleImportDbml` wrappers) — and dropped
  the stashed side, which was the pre-DBML inline `handleImportPrisma`.
  The upstream side also re-declared `const entityList`, which the writer had already added at line 161:
  two `const entityList` in one scope is a `SyntaxError`, so the duplicate was dropped.
- `README.md` (Uso rápido list): merged both — DBML stays step 6, the edge-sides step was added as 7 and
  `Vista previa` was renumbered to 8.

### Lint regressions introduced by the feature (fixed)

1. `RelationEdge.tsx` exported `RelationActionsContext` from a module that also exports a component ->
   `react-refresh/only-export-components`. Moved the context to `src/components/relationActions.ts`.
2. `ErEditor.tsx` assigned `flipRef.current = flipRelation` **during render** -> `react-hooks/refs`
   (21 -> 22). The ref-based stable-identity trick was unnecessary: `useMemo(() => ({ flip: flipRelation }),
   [flipRelation])` is enough and removes the ref entirely.

## Evidence

- `bun test` -> **30 pass, 0 fail, 123 expect() calls** (`parseDbml` 13 + `sides` 17).
- `bun run lint` -> **26 problems (25 errors, 1 warning)**, exactly the `HEAD` baseline. Per file:
  `ErEditor.tsx` 21 (== HEAD 21), `Inspector.tsx` 1 (== HEAD 1), `RelationEdge.tsx` 0 (== HEAD 0),
  `relationActions.ts` 0. No new problem in any changed file.
- `bun run build` -> success (vite, 220 modules, `index.js 491.67 kB`).
- `bunx tsc --noEmit -p tsconfig.app.json` -> 4 errors, all pre-existing categories: 2x `bun:test`
  (no `@types/bun`) and 2x `clsx`/`tailwind-merge` in the unimported `src/lib/utils.ts`. **No app-code
  error**, so the conflicted `ErEditor.tsx` is type-coherent again (no duplicate declaration, no TDZ).
- Conflict markers: none left in `src/`, `README.md` or `odd/`.
- The DBML feature survived the resolution: `applyImport` + both import wrappers are present and
  `parseDbml`'s 13 tests still pass.

## Notes

- Commits are deferred by explicit user decision. The edge-sides work is uncommitted on `master`.
- Two stashes remain from the incident (`stash@{0}` holds the full edge-sides work, `stash@{1}` a
  partial version without `sides.ts`). They were left untouched; dropping them is a human decision.

## Independent verification (`gentle-ai-verify`, read-only)

- **Conflict resolution**: nothing dropped or duplicated. Every declaration appears exactly once, no
  `flipRef` left anywhere, no conflict marker anywhere, `README.md`'s list is 1..8 with no gap.
- **Flip path**: traced hop by hop through the React Flow source. `setEdges` does recompute
  `sourceHandle`/`targetHandle` and `@xyflow/react` re-derives edge positions from those handle ids, so
  **the line visibly moves**. Context propagation through `EdgeLabelRenderer`'s portal is valid because
  the portal target is rendered inside the provider's subtree.
- **`pointer-events`**: the button carries only `er-edge-action` (never `er-edge-label`), and
  `.er-edge-action { pointer-events: auto }` re-enables hit-testing against the inherited
  `pointer-events: none`. Chain is correct statically.
- **Inspector**: `Auto` genuinely clears the pin (`undefined` overwrites through the spread patch), and
  all **10** `sideHandle(` call sites now receive `byId` — none is missing.
- **`sides.ts` probes** (7 adversarial cases: symmetry, double flip, effective vs concrete, field pins,
  `sideOfHandle` garbage, self-relation, missing entity, preservation): all match the spec.
- **DBML regression**: intact, and `applyImport` is byte-identical to `HEAD`, proving the resolution did
  not alter it.
- The verifier corrected an error in the original spec: without `byId`, `sideHandle` returns `undefined`
  (not `'sr'`/`'tl'` — React Flow then applies its own default handle). The comment in
  `src/lib/sides.test.ts` was fixed; the assertion was already correct.

### Still unverified (needs a browser or Tauri session)

Real mouse hit-testing of `⇄` (stacking/z-order against the node layer), context-through-portal as an
actual render, the `F` shortcut end to end, and the segmented control moving the line in the DOM.

### Found while verifying, NOT fixed (separate decision)

`applyImport` builds its edges without `sourceHandle`/`targetHandle`, so after importing Prisma or DBML
fresh relations have no handle id and React Flow falls back to its own default handle until the diagram
is reopened. `toEdges` (used on load) does compute them, so an imported diagram renders differently from
the same diagram after a reload. Verified byte-identical to `HEAD`: **pre-existing, not a regression** of
this resolution. Fixing it is a small, separate change in `ErEditor.applyImport`.
