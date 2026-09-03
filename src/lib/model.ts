export interface Field {
  id: string;
  name: string;
  isPk: boolean;
  isFk: boolean;
}

export interface Entity {
  id: string;
  name: string;
  table: string;
  focal?: boolean;
  x: number;
  y: number;
  fields: Field[];
}

export type Side = "L" | "R";

export interface Relation {
  id: string;
  source: string;
  target: string;
  sourceCard: string;
  targetCard: string;
  label: string;

  sourceFieldId?: string;

  targetFieldId?: string;

  sourceSide?: Side;

  targetSide?: Side;
}

export interface FieldHandleInfo {
  fieldId: string;
  side: Side;
  type: "src" | "tgt";
}

export function fieldHandleId(fieldId: string, side: Side, type: "src" | "tgt"): string {
  return `f:${fieldId}:${side}:${type}`;
}

export function parseFieldHandle(handleId: string | null | undefined): FieldHandleInfo | null {
  if (!handleId) return null;
  const m = /^f:([^:]+):([LR]):(src|tgt)$/.exec(handleId);
  if (!m) return null;
  return { fieldId: m[1], side: m[2] as Side, type: m[3] as "src" | "tgt" };
}

export interface Group {
  id: string;
  name: string;
  createdAt: number;
}

export interface Diagram {
  id?: string;
  savedAt?: number;
  groupId?: string;
  slug?: string;
  title: string;
  subtitle: string;
  entities: Entity[];
  relations: Relation[];
}

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function uniqueSlug(slug: string, excludeId: string | undefined, list: Diagram[]): string {
  if (!slug) return "";
  let candidate = slug;
  let n = 2;
  while (list.some((d) => d.id !== excludeId && d.slug === candidate)) {
    candidate = `${slug}-${n}`;
    n += 1;
  }
  return candidate;
}

let counter = 0;
export function uid(): string {
  counter += 1;
  return `n-${Date.now().toString(36)}-${counter}`;
}

export function emptyDiagram(): Diagram {
  return {
    title: "Nuevo modelo ER",
    subtitle: "Modelo entidad-relación · dexagram",
    entities: [],
    relations: [],
  };
}

export function seedSalud(): Diagram {
  return {
    title: "Salud y ciclo — modelo relacional",
    subtitle:
      "Dominio de ciclos menstruales, síntomas, períodos y embarazos · backend Luna (EF Core, PostgreSQL)",
    entities: [
      {
        id: "e-users",
        name: "Users",
        table: "users",
        focal: true,
        x: 380,
        y: 200,
        fields: [
          { id: "f-users-1", name: "id", isPk: true, isFk: false },
          { id: "f-users-2", name: "name", isPk: false, isFk: false },
          { id: "f-users-3", name: "email", isPk: false, isFk: false },
          { id: "f-users-4", name: "role", isPk: false, isFk: false },
          { id: "f-users-5", name: "life_stage", isPk: false, isFk: false },
        ],
      },
      {
        id: "e-cycles",
        name: "Cycles",
        table: "cycles",
        x: 40,
        y: 40,
        fields: [
          { id: "f-cycles-1", name: "id", isPk: true, isFk: false },
          { id: "f-cycles-2", name: "user_id", isPk: false, isFk: true },
          { id: "f-cycles-3", name: "start_date", isPk: false, isFk: false },
          { id: "f-cycles-4", name: "end_date", isPk: false, isFk: false },
          { id: "f-cycles-5", name: "cycle_length", isPk: false, isFk: false },
          { id: "f-cycles-6", name: "luteal_length", isPk: false, isFk: false },
          { id: "f-cycles-7", name: "is_current", isPk: false, isFk: false },
        ],
      },
      {
        id: "e-cycledays",
        name: "CycleDays",
        table: "cycle_days",
        x: 40,
        y: 320,
        fields: [
          { id: "f-cd-1", name: "id", isPk: true, isFk: false },
          { id: "f-cd-2", name: "cycle_id", isPk: false, isFk: true },
          { id: "f-cd-3", name: "date", isPk: false, isFk: false },
          { id: "f-cd-4", name: "phase", isPk: false, isFk: false },
          { id: "f-cd-5", name: "is_period_day", isPk: false, isFk: false },
          { id: "f-cd-6", name: "is_fertile_window", isPk: false, isFk: false },
          { id: "f-cd-7", name: "is_ovulation_day", isPk: false, isFk: false },
        ],
      },
      {
        id: "e-period",
        name: "PeriodEntries",
        table: "period_entries",
        x: 680,
        y: 40,
        fields: [
          { id: "f-p-1", name: "id", isPk: true, isFk: false },
          { id: "f-p-2", name: "user_id", isPk: false, isFk: true },
          { id: "f-p-3", name: "start_date", isPk: false, isFk: false },
          { id: "f-p-4", name: "end_date", isPk: false, isFk: false },
          { id: "f-p-5", name: "flow_intensity", isPk: false, isFk: false },
          { id: "f-p-6", name: "notes", isPk: false, isFk: false },
        ],
      },
      {
        id: "e-symptom",
        name: "SymptomEntries",
        table: "symptom_entries",
        x: 680,
        y: 188,
        fields: [
          { id: "f-s-1", name: "id", isPk: true, isFk: false },
          { id: "f-s-2", name: "user_id", isPk: false, isFk: true },
          { id: "f-s-3", name: "date", isPk: false, isFk: false },
          { id: "f-s-4", name: "symptom", isPk: false, isFk: false },
          { id: "f-s-5", name: "severity", isPk: false, isFk: false },
          { id: "f-s-6", name: "mood", isPk: false, isFk: false },
          { id: "f-s-7", name: "sleep_quality", isPk: false, isFk: false },
        ],
      },
      {
        id: "e-preg",
        name: "Pregnancies",
        table: "pregnancies",
        x: 680,
        y: 352,
        fields: [
          { id: "f-pr-1", name: "id", isPk: true, isFk: false },
          { id: "f-pr-2", name: "user_id", isPk: false, isFk: true },
          { id: "f-pr-3", name: "last_menstrual_period", isPk: false, isFk: false },
          { id: "f-pr-4", name: "estimated_due_date", isPk: false, isFk: false },
          { id: "f-pr-5", name: "current_week", isPk: false, isFk: false },
          { id: "f-pr-6", name: "is_active", isPk: false, isFk: false },
        ],
      },
    ],
    relations: [
      {
        id: "r-1",
        source: "e-users",
        target: "e-cycles",
        sourceCard: "1",
        targetCard: "N",
        label: "REGISTRA",
        sourceFieldId: "f-users-1",
        targetFieldId: "f-cycles-2",
        sourceSide: "R",
        targetSide: "L",
      },
      {
        id: "r-2",
        source: "e-cycles",
        target: "e-cycledays",
        sourceCard: "1",
        targetCard: "N",
        label: "COMPONE",
        sourceFieldId: "f-cycles-1",
        targetFieldId: "f-cd-2",
        sourceSide: "R",
        targetSide: "L",
      },
      {
        id: "r-3",
        source: "e-users",
        target: "e-period",
        sourceCard: "1",
        targetCard: "N",
        label: "REGISTRA",
        sourceFieldId: "f-users-1",
        targetFieldId: "f-p-2",
        sourceSide: "R",
        targetSide: "L",
      },
      {
        id: "r-4",
        source: "e-users",
        target: "e-symptom",
        sourceCard: "1",
        targetCard: "N",
        label: "REGISTRA",
        sourceFieldId: "f-users-1",
        targetFieldId: "f-s-2",
        sourceSide: "R",
        targetSide: "L",
      },
      {
        id: "r-5",
        source: "e-users",
        target: "e-preg",
        sourceCard: "1",
        targetCard: "N",
        label: "TIENE",
        sourceFieldId: "f-users-1",
        targetFieldId: "f-pr-2",
        sourceSide: "R",
        targetSide: "L",
      },
    ],
  };
}
