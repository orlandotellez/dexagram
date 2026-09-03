import type { Diagram, Group } from "./model";
import { seedSalud, uid } from "./model";

const LS_LIST = "dexagram:diagrams";
const LS_GROUPS = "dexagram:groups";
const LS_LEGACY = "dexagram:diagram";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readList(): Diagram[] {
  const parsed = safeParse<Diagram[]>(localStorage.getItem(LS_LIST));
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed.filter((d) => d && typeof d === "object" && Array.isArray(d.entities));
}

function writeList(list: Diagram[]): void {
  try {
    localStorage.setItem(LS_LIST, JSON.stringify(list));
  } catch {
    // quota exceeded — silently ignore
  }
}

export function listDiagrams(): Diagram[] {
  const list = readList();
  if (list.length > 0) return list;

  const legacy = safeParse<Diagram>(localStorage.getItem(LS_LEGACY));
  if (legacy && typeof legacy === "object" && Array.isArray(legacy.entities)) {
    localStorage.removeItem(LS_LEGACY);
    const migrated = [
      { ...legacy, id: legacy.id ?? `d-${Date.now().toString(36)}`, savedAt: Date.now() },
    ];
    writeList(migrated);
    return migrated;
  }
  return [];
}

export function saveDiagrams(list: Diagram[]): void {
  const sorted = [...list].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  writeList(sorted);
}

function readGroups(): Group[] {
  const parsed = safeParse<Group[]>(localStorage.getItem(LS_GROUPS));
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed.filter(
    (g) => g && typeof g === "object" && typeof g.id === "string" && typeof g.name === "string",
  );
}

export function listGroups(): Group[] {
  return readGroups().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export function saveGroups(list: Group[]): void {
  try {
    localStorage.setItem(LS_GROUPS, JSON.stringify(list));
  } catch {
    // quota exceeded
  }
}

export function ensureBootstrap(): { groups: Group[]; diagrams: Diagram[] } {
  const groups = listGroups();
  let diagrams = listDiagrams();

  if (groups.length === 0 && diagrams.length === 0) {
    const g: Group = { id: uid(), name: "Mi primer proyecto", createdAt: Date.now() };
    const seed: Diagram = { ...seedSalud(), id: uid(), groupId: g.id, savedAt: Date.now() };
    saveGroups([g]);
    saveDiagrams([seed]);
    return { groups: [g], diagrams: [seed] };
  }

  if (groups.length === 0 && diagrams.length > 0) {
    const g: Group = { id: uid(), name: "Mi primer proyecto", createdAt: Date.now() };
    diagrams = diagrams.map((d) => ({ ...d, groupId: g.id }));
    saveGroups([g]);
    saveDiagrams(diagrams);
    return { groups: [g], diagrams };
  }

  return { groups, diagrams };
}

export function findDiagramBySlugOrId(
  list: Diagram[],
  slugOrId: string,
): Diagram | null {
  return (
    list.find((d) => d.slug && d.slug === slugOrId) ??
    list.find((d) => d.id === slugOrId) ??
    null
  );
}

export function downloadJson(diagram: Diagram): void {
  downloadFile("diagram.json", JSON.stringify(diagram, null, 2), "application/json");
}

export function downloadFile(
  name: string,
  content: string,
  mime = "text/html",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function uploadJson(file: File): Promise<Diagram> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Diagram;
        if (!parsed || !Array.isArray(parsed.entities)) {
          reject(new Error("El archivo no es un diagrama válido"));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new Error("No se pudo parsear el archivo JSON"));
      }
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsText(file);
  });
}
