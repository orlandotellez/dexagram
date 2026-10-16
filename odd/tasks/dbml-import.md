# Feature: DBML import — generate diagrams from pasted DBML

**Branch:** `feat/dbml-import`
**Status:** implemented, independently verified
**Created:** 2026-02-XX

## Intent (authorized)

Allow pasting DBML code into Dexagram and generate the ER diagram (entities + relations) from it.
When nothing is selected in the inspector, the current empty-state message is replaced by a DBML
paste box that generates the diagram.

## Acceptance criteria

1. Pasting the reference DBML sample (tables `users`, `posts`, `follows` + long-form `Ref` lines)
   produces 3 entities with their fields and the 3 expected relations.
2. Field attributes `[pk]` / `[primary key]` map to `isPk`; the FK side of a relation maps to `isFk`.
3. Relation operators map to cardinalities: `>` → 1:N, `<` → 1:N, `-` → 1:1, `<>` → N:N.
4. `Records` seed blocks, `Enum`, `TableGroup`, `Project`, `Note`, `indexes { }` blocks are ignored
   without breaking the parse (the model has no place for row data).
5. Comments (`//`, `/* */`), quoted identifiers, table aliases (`as U`), schemas (`schema.table`) and
   composite refs (`A.(x,y) > B.(p,q)`) are handled or degraded gracefully; the parser never throws.
6. With nothing selected in the inspector, the empty state shows the DBML box and a generate action.
7. Importing replaces the current diagram content, same as the existing Prisma import.

## Non-goals

- No DBML export (only import).
- No custom layout/auto-layout engine: reuse the existing grid + React Flow node/edge replace path.
- No storage of `Records` rows.

## Design

### `src/lib/parseDbml.ts` (new)

`parseDbml(source: string): { entities: Entity[]; relations: Relation[] }` — mirrors the
`parsePrisma` contract (`DbmlParseResult`).

Mapping to the Dexagram model (consistent with `parsePrisma.ts`):
the relation `source` is the **one / parent** side and `target` is the **many / child (FK holder)** side.

| DBML ref | fk (child) | parent (referenced) | source | target | sourceCard | targetCard |
| --- | --- | --- | --- | --- | --- | --- |
| `A.x > B.y` | `A.x` | `B.y` | `B` | `A` | `1` | `N` |
| `A.x < B.y` | `B.y` | `A.x` | `A` | `B` | `1` | `N` |
| `A.x - B.y` | `B.y` | `A.x` | `A` | `B` | `1` | `1` |
| `A.x <> B.y` | — | — | `A` | `B` | `N` | `N` |

- The FK-holding field gets `isFk = true` (except `<>`).
- `sourceFieldId` / `targetFieldId` pin the referenced / FK fields.
- `label` = the declared `Ref` name when present (e.g. `Ref user_posts: ...` → `user_posts`), else `''`.
- `sourceSide` / `targetSide` are left undefined so the editor recomputes geometry.
- Refs are resolved after the whole document is read (a `Ref` may precede its tables).
- Table lookup: exact name → case-insensitive → alias.
- Composite refs keep only the first field pair.
- Line positions use the same grid as `parsePrisma` (`x = (i % 4) * 280`, `y = floor(i / 4) * 200`).

### Wiring

- `src/components/ErEditor.tsx`: add `handleImportDbml` reusing the shared replace/layout path used by
  `handleImportPrisma` (extract one `applyImport(result)` helper); pass `onImportDbml` to `Inspector`.
- `src/components/Inspector.tsx`: extract a reusable `DbmlImport` panel; mount it
  (a) in the empty state of the entity tab, replacing the current message, and
  (b) in the Importar / Exportar tab next to the Prisma importer for reachability.
  A short warning notes that importing replaces the current diagram.
- `src/global.css`: empty-state and panel styling reusing `.insp-textarea` / `.insp-section-title`.
- `src/lib/parseDbml.test.ts` (new) + `test` script in `package.json` (`bun test`).
- `README.md`: document DBML import (Spanish, matching the file's existing convention).

## Tasks

- [x] T1 — Branch + ODD task document
- [x] T2 — Parser tests for the reference sample and edge cases (RED with `bun test`)
- [x] T3 — Implement `src/lib/parseDbml.ts` (GREEN)
- [x] T4 — Wire `ErEditor` (shared `applyImport` + `onImportDbml`)
- [x] T5 — Inspector: DBML panel in the empty state + Import/Export tab
- [x] T6 — CSS (`.insp-hint`)
- [x] T7 — README + `test` script
- [x] T8 — Verify: `bun test`, `bun run lint`, `bun run build`
- [x] T9 — Fix the silent empty-replace path found during verification

## Evidence

Delegated to `gentle-ai-worker` (task `mvaenes2-1-bj2u`), then independently reviewed and verified by the parent.

- RED: `bun test src/lib/parseDbml.test.ts` -> `0 pass, 1 fail` (`Cannot find module './parseDbml'`).
- GREEN: `bun test` -> **13 pass, 0 fail, 79 expect() calls**.
- Independent parent check (throwaway script, NOT the worker's test) against the reference DBML sample ->
  3 entities (`follows` 3 fields / 2 FK, `users` 4 fields / `id` PK, `posts` 6 fields / `id` PK + `user_id` FK)
  and exactly 3 relations, all `users.id 1 -> <child>.<fk> N`, with `label="user_posts"` only on the named ref.
- `bun run build` -> success (vite 7.3.6, 220 modules).
- `bun run lint` -> exit 1 on the pre-existing baseline only: 26 problems at HEAD and 26 now, same rules
  (ErEditor 21x `react-hooks/refs`, HomePage 3x `react-hooks/refs`, Inspector 1x `react-refresh`, plus one
  parsing error on a gitignored `src-tauri` build artifact). Both new files lint clean. Independently
  confirmed by `gentle-ai-verify` (task `mvaeyvuh-2-7oke`), then re-confirmed by the parent after the
  post-verification fix.
- `bunx tsc --noEmit -p tsconfig.app.json` -> 3 errors: 2 pre-existing (`clsx`, `tailwind-merge` in
  `src/lib/utils.ts`) and 1 new: `src/lib/parseDbml.test.ts(1,40) Cannot find module 'bun:test'`,
  because `@types/bun` is not installed and adding it was outside the writer's surfaces.
- Commits: **none** — deferred to the human (see the safety rule on commits).

### Independent verification (`gentle-ai-verify`, read-only)

- `applyImport` (ErEditor.tsx:581-602) is byte-identical to HEAD's inline `handleImportPrisma` body:
  same grid, `setNodes`, `setEdges` with `markerEnd`, `setSelection(null)`. No behavior change beyond extraction.
- 10 adversarial parser probes: ref-direction symmetry (`A.x > B.y` == `B.y < A.x`), alias/qualified/short
  name resolution, ref declared before its tables, inline ref before its table exists, quoted braces and
  apostrophes inside `Records`, missing referenced field, `-` with a missing field, `<>` pinning no fields
  and setting no `isFk`, self-references, case-insensitive lookup -> all match the spec.
- Confirmed: the DBML path resolves the reference sample to the same 3 entities / 3 relations as the parent's
  own independent check.

### Post-verification fix (parent, after the verifier's report)

The verifier flagged that `parseDbml` never throws, so unparseable input returns empty arrays and
`applyImport` silently replaced the diagram with an empty canvas. Fixed:

- `ErEditor.handleImportDbml` now returns the imported entity count and returns `0` without calling
  `applyImport` when nothing parsed.
- `Inspector.DbmlImport` reports `No se reconoció ninguna tabla en el DBML. Revisá el esquema.`
  (`.insp-hint-error`) and keeps the pasted text so it can be corrected instead of losing the draft.
- The Prisma path was intentionally left as-is; it has the same pre-existing pattern and is out of scope.

## Open items

- `bun:test` type declarations: either add `@types/bun` as a devDependency (makes the test file
  type-check properly) or exclude `src/**/*.test.ts` from `tsconfig.app.json`. Not a build gate today
  (`build` is `vite build` only, and `tsc` is already red at HEAD), but it is a new error line.
- A **truncated, unbalanced** final `Table x {` block swallows the rest of the file into that table's body
  (`readBalanced` runs to EOF) and can absorb a bogus field. It never throws, which is what the spec
  requires, but the degradation is lossy. Low impact: a truncated paste is truncated at the end.
- `integer[]` IS preserved (`integer[5]` too). Only `integer []` **with a space before the bracket** is
  misread as type `integer` plus an empty attribute group. An earlier note in this document claimed the
  no-space form was also affected; the verifier disproved that.
- Duplicate table names emit two entities; refs resolve to the last one. No crash.
- A draft typed in the empty-state panel is discarded if an entity gets selected (component unmounts).
- `Records` row data is intentionally dropped: the Dexagram model has no row representation.
